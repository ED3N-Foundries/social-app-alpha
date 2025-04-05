// Import required Bun modules
import { serve } from "bun";
import { Database } from "bun:sqlite";
import NameStone from "@namestone/namestone-sdk";
import { SERVER_PORT } from "./consts";

// Shared types between client and server
export interface User {
	id?: number;
	email: string;
	wallet_address: string;
	ens_name?: string;
	created_at: string;
}

export interface TokenBalance {
	id: string;
	address: string;
	name: string;
	symbol: string;
	balance: number;
	value: number;
}

export interface HolderBalanceResponse {
	id: string;
	address: string;
	totalValue: number;
	tokens: TokenBalance[];
}

export interface MetalHolderResponse {
	address: string;
	id?: string;
	userId?: string;
	createdAt?: string;
	updatedAt?: string;
}

// Initialize SQLite database
const db = new Database("app.db");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    wallet_address TEXT UNIQUE,
    ens_name TEXT,
    created_at TEXT NOT NULL
  )
`);

// Metal API configuration
const METAL_API_PUBLIC_KEY = process.env.METAL_API_PUBLIC_KEY;
const METAL_API_PRIVATE_KEY = process.env.METAL_API_PRIVATE_KEY;
const METAL_API_URL_BASE = "https://api.metal.build";

// NameStone API configuration
const NAMESTONE_API_KEY = process.env.NAMESTONE_API_KEY;

// Initialize NameStone SDK
const namestone = new NameStone(NAMESTONE_API_KEY);

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

// Helper function to create or update ENS name
async function createOrUpdateEnsName(
	walletAddress: string,
	ensName: string,
): Promise<boolean> {
	try {
		// Ensure the ENS name ends with .eth
		const normalizedEnsName = ensName.endsWith(".eth")
			? ensName
			: `${ensName}.eth`;

		const nameWithoutDomain = normalizedEnsName.replace(".eth", "");

		// Use NameStone SDK to set name
		await namestone.setName({
			address: walletAddress,
			domain: "eth", // Using the default .eth domain
			name: nameWithoutDomain, // Remove .eth since the domain is specified separately
			text_records: {
				description: "ENS name created via social-app-alpha",
			},
		});

		// Update ENS name in the database
		db.query("UPDATE users SET ens_name = ? WHERE wallet_address = ?").run(
			normalizedEnsName,
			walletAddress,
		);

		return true;
	} catch (error) {
		console.error("Error setting ENS name:", error);
		return false;
	}
}

// Helper function to get ENS name for an address
async function getEnsName(walletAddress: string): Promise<string | null> {
	try {
		// First check our database
		const user = db
			.query("SELECT ens_name FROM users WHERE wallet_address = ?")
			.get(walletAddress) as { ens_name: string } | null;

		if (user?.ens_name) {
			return user.ens_name;
		}

		// If not found in database, check NameStone API using the SDK
		const namesData = await namestone.getNames({
			address: walletAddress,
			domain: "eth",
		});

		if (namesData.length > 0) {
			const ensName = `${namesData[0].name}.eth`;

			// Update our database with the ENS name
			db.query("UPDATE users SET ens_name = ? WHERE wallet_address = ?").run(
				ensName,
				walletAddress,
			);

			return ensName;
		}

		return null;
	} catch (error) {
		console.error("Error getting ENS name:", error);
		return null;
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

					// Check if user already exists
					const existingUser = db
						.query("SELECT * FROM users WHERE email = ?")
						.get(email) as User | null;

					if (existingUser) {
						// If the user exists, return the user data
						return addCorsHeaders(
							Response.json({
								success: true,
								email: existingUser.email,
								wallet_address: existingUser.wallet_address,
								ens_name: existingUser.ens_name,
								created_at: existingUser.created_at,
							}),
						);
					}

					if (!METAL_API_PRIVATE_KEY) {
						throw new Error("METAL_API_PRIVATE_KEY is not set");
					}

					let user: User;
					// Create a new holder wallet using Metal API
					try {
						// Create a new holder with Metal API - using email as the holder ID
						const response = await fetch(
							`${METAL_API_URL_BASE}/holder/${encodeURIComponent(email)}?privateKey=${METAL_API_PRIVATE_KEY}`,
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

						user = {
							email,
							wallet_address: holder.address,
							created_at: new Date().toISOString(),
						};
					} catch (error) {
						console.error("Error creating wallet:", error);
						throw error;
					}

					const ensName = await getEnsName(user.wallet_address);

					return addCorsHeaders(
						Response.json({
							success: true,
							email: user.email,
							wallet_address: user.wallet_address,
							ens_name: ensName,
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
			GET: async (req) => {
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

					// Get ENS name using the wallet address
					const ensName = await getEnsName(user.wallet_address);

					return addCorsHeaders(
						Response.json({
							email: user.email,
							wallet_address: user.wallet_address,
							ens_name: ensName,
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

		// Set/Update ENS name for a user
		"/ens/set-name": {
			POST: async (req) => {
				try {
					const { wallet_address, ens_name } = await req.json();

					if (!wallet_address || !ens_name) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({
									error: "Wallet address and ENS name are required",
								}),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Check if the user exists
					const user = db
						.query("SELECT * FROM users WHERE wallet_address = ?")
						.get(wallet_address) as User | null;

					if (!user) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "User not found" }), {
								status: 404,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					const success = await createOrUpdateEnsName(wallet_address, ens_name);

					if (!success) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({ error: "Failed to set ENS name" }),
								{
									status: 500,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					return addCorsHeaders(
						Response.json({
							success: true,
							wallet_address,
							ens_name: ens_name.endsWith(".eth")
								? ens_name
								: `${ens_name}.eth`,
						}),
					);
				} catch (error) {
					console.error("Set ENS name error:", error);
					return addCorsHeaders(
						new Response(JSON.stringify({ error: "Failed to set ENS name" }), {
							status: 500,
							headers: { "Content-Type": "application/json" },
						}),
					);
				}
			},
		},

		// Get token balance from Metal API
		"/metal/holder/:email/balance": {
			GET: async (req) => {
				try {
					const { email } = req.params;

					if (!email) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "Email is required" }), {
								status: 400,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					if (!METAL_API_PUBLIC_KEY) {
						throw new Error("METAL_API_PUBLIC_KEY is not set");
					}

					const url = `${METAL_API_URL_BASE}/holder/${encodeURIComponent(email)}?publicKey=${METAL_API_PUBLIC_KEY}`;

					// Call Metal API to get holder's token balance
					const response = await fetch(url, {
						method: "GET",
						headers: {
							"Content-Type": "application/json",
						},
					});

					if (!response.ok) {
						throw new Error(`Metal API ${url} error: ${response.status}`);
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
						.query(
							"SELECT email, wallet_address, ens_name, created_at FROM users",
						)
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
