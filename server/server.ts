// Import required Bun modules
import { serve } from "bun";
import { Database } from "bun:sqlite";
import {
	type User,
	type MetalHolderResponse,
	type TokenBalance,
	type HolderBalanceResponse,
	SERVER_PORT,
} from "../types";

// Initialize SQLite database
const db = new Database("app.db");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    wallet_address TEXT UNIQUE,
    created_at TEXT NOT NULL
  )
`);

// Metal API configuration
const METAL_API_PUBLIC_KEY = process.env.METAL_API_PUBLIC_KEY;
const METAL_API_PRIVATE_KEY = process.env.METAL_API_PRIVATE_KEY;
const METAL_API_URL_BASE = "https://api.metal.build";

// NameStone API configuration
const NAMESTONE_API_KEY = process.env.NAMESTONE_API_KEY;
const NAMESTONE_API_URL_BASE = "https://namestone.com/api/public_v1/";

// Master Polygon Wallet
const MASTER_POLYGON_WALLET_ADDRESS = process.env.MASTER_POLYGON_WALLET_ADDRESS;
const MASTER_POLYGON_WALLET_PRIVATE_KEY =
	process.env.MASTER_POLYGON_WALLET_PRIVATE_KEY;
const MASTER_POLYGON_RPC_URL_BASE = "https://polygon-rpc.com";

// CORS headers helper function
function addCorsHeaders(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.set("Access-Control-Allow-Origin", "*");
	headers.set(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, OPTIONS",
	);
	headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

// Helper function to get or create a wallet for a user
async function getOrCreateWallet(email: string): Promise<User> {
	// Check if user already exists
	const existingUser = db
		.query("SELECT * FROM users WHERE email = ?")
		.get(email) as User | null;

	if (existingUser) {
		return existingUser;
	}

	if (!METAL_API_PRIVATE_KEY) {
		throw new Error("METAL_API_PRIVATE_KEY is not set");
	}

	// Create a new holder wallet using Metal API
	try {
		// Use user's email as userId for Metal
		const response = await fetch(
			`${METAL_API_URL_BASE}/holder/${encodeURIComponent(email)}`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": METAL_API_PRIVATE_KEY,
				},
			},
		);

		if (!response.ok) {
			throw new Error(`Metal API error: ${response.status}`);
		}

		const holder = (await response.json()) as MetalHolderResponse;

		// Save the wallet address in the database
		db.query(
			"INSERT INTO users (email, wallet_address, created_at) VALUES (?, ?, ?)",
		).run(email, holder.address, new Date().toISOString());

		return {
			email,
			wallet_address: holder.address,
			created_at: new Date().toISOString(),
		};
	} catch (error) {
		console.error("Error creating wallet:", error);
		throw error;
	}
}

// Start the server
serve({
	port: SERVER_PORT,
	async fetch(req, server) {
		// Handle CORS preflight requests
		if (req.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
					"Access-Control-Max-Age": "86400",
				},
			});
		}

		// Continue with normal request handling
		const response = await server.fetch(req);
		return addCorsHeaders(response);
	},
	routes: {
		// Health check endpoint
		"/health": () => addCorsHeaders(new Response("OK")),

		// Metal wallet endpoints
		"/metal/login": {
			POST: async (req) => {
				try {
					const { email } = await req.json();

					if (!email || typeof email !== "string") {
						return addCorsHeaders(
							new Response(
								JSON.stringify({ error: "Valid email is required" }),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					const user = await getOrCreateWallet(email);

					return addCorsHeaders(
						Response.json({
							success: true,
							email: user.email,
							wallet_address: user.wallet_address,
						}),
					);
				} catch (error) {
					console.error("Login error:", error);
					return addCorsHeaders(
						new Response(JSON.stringify({ error: "Failed to process login" }), {
							status: 500,
							headers: { "Content-Type": "application/json" },
						}),
					);
				}
			},
		},

		// Get user wallet information
		"/metal/user/:email": {
			GET: (req) => {
				try {
					const { email } = req.params;

					if (!email) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({ error: "Email parameter is required" }),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					const user = db
						.query("SELECT * FROM users WHERE email = ?")
						.get(email) as User | null;

					if (!user) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "User not found" }), {
								status: 404,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					return addCorsHeaders(
						Response.json({
							email: user.email,
							wallet_address: user.wallet_address,
							created_at: user.created_at,
						}),
					);
				} catch (error) {
					console.error("Get user error:", error);
					return addCorsHeaders(
						new Response(
							JSON.stringify({ error: "Failed to retrieve user data" }),
							{ status: 500, headers: { "Content-Type": "application/json" } },
						),
					);
				}
			},
		},

		// Get token balance from Metal API
		"/metal/holder/:address/balance": {
			GET: async (req) => {
				try {
					const { address } = req.params;

					if (!address) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({ error: "Wallet address is required" }),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					if (!METAL_API_PUBLIC_KEY) {
						throw new Error("METAL_API_PUBLIC_KEY is not set");
					}

					// Call Metal API to get holder's token balance
					const response = await fetch(
						`${METAL_API_URL_BASE}/holder/${address}?publicKey=${METAL_API_PUBLIC_KEY}`,
						{
							method: "GET",
							headers: {
								"Content-Type": "application/json",
							},
						},
					);

					if (!response.ok) {
						throw new Error(`Metal API error: ${response.status}`);
					}

					const holderData = (await response.json()) as HolderBalanceResponse;

					return addCorsHeaders(Response.json(holderData));
				} catch (error) {
					console.error("Get balance error:", error);
					return addCorsHeaders(
						new Response(
							JSON.stringify({ error: "Failed to retrieve token balance" }),
							{ status: 500, headers: { "Content-Type": "application/json" } },
						),
					);
				}
			},
		},

		// List all users (for admin/debug purposes)
		"/metal/users": {
			GET: () => {
				try {
					const users = db
						.query("SELECT email, wallet_address, created_at FROM users")
						.all() as User[];
					return addCorsHeaders(Response.json(users));
				} catch (error) {
					console.error("List users error:", error);
					return addCorsHeaders(
						new Response(JSON.stringify({ error: "Failed to list users" }), {
							status: 500,
							headers: { "Content-Type": "application/json" },
						}),
					);
				}
			},
		},
	},

	// Error handler
	error(error) {
		console.error("Server error:", error);
		return addCorsHeaders(
			new Response("Internal Server Error", { status: 500 }),
		);
	},
});

console.log("Server running at http://localhost:3000");
