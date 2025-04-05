// Import required Bun modules
import { serve } from "bun";
import { Database } from "bun:sqlite";
import { SERVER_PORT } from "./consts";
import { SiweMessage } from "siwe";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Shared types between client and server
export interface User {
	id?: number;
	email: string;
	wallet_address: string;
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

export interface Event {
	id?: number;
	title: string;
	description: string;
	date: string;
	location: string;
	image_url?: string;
	creator_email: string;
	created_at: string;
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
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    location TEXT,
    image_url TEXT,
    creator_email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (creator_email) REFERENCES users(email)
  )
`);

// Metal API configuration
const METAL_API_PUBLIC_KEY = process.env.METAL_API_PUBLIC_KEY;
const METAL_API_PRIVATE_KEY = process.env.METAL_API_PRIVATE_KEY;
const METAL_API_URL_BASE = "https://api.metal.build";

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

		// Event API endpoints
		"/events": {
			GET: () => {
				try {
					const events = db
						.query("SELECT * FROM events ORDER BY date DESC")
						.all() as Event[];
					return addCorsHeaders(Response.json(events));
				} catch (error) {
					console.error("List events error:", error);
					return addCorsHeaders(
						new Response(JSON.stringify({ error: "Failed to list events" }), {
							status: 500,
							headers: { "Content-Type": "application/json" },
						}),
					);
				}
			},
		},

		"/events/create": {
			POST: async (req) => {
				try {
					const {
						title,
						description,
						date,
						location,
						image_url,
						creator_email,
					} = await req.json();

					if (!title || !date || !creator_email) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({
									error: "Title, date, and creator_email are required",
								}),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Verify the creator exists
					const creator = db
						.query("SELECT * FROM users WHERE email = ?")
						.get(creator_email) as User | null;

					if (!creator) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "Creator not found" }), {
								status: 404,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					// Insert the new event
					const result = db
						.query(
							"INSERT INTO events (title, description, date, location, image_url, creator_email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
						)
						.run(
							title,
							description || "",
							date,
							location || "",
							image_url || "",
							creator_email,
							new Date().toISOString(),
						);

					// Get the newly created event
					const newEvent = db
						.query("SELECT * FROM events WHERE id = ?")
						.get(result.lastInsertRowid) as Event;

					return addCorsHeaders(Response.json(newEvent));
				} catch (error) {
					console.error("Create event error:", error);
					return addCorsHeaders(
						new Response(JSON.stringify({ error: "Failed to create event" }), {
							status: 500,
							headers: { "Content-Type": "application/json" },
						}),
					);
				}
			},
		},

		"/events/:id": {
			GET: (req) => {
				try {
					const { id } = req.params;

					if (!id) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "Event ID is required" }), {
								status: 400,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					const event = db
						.query("SELECT * FROM events WHERE id = ?")
						.get(id) as Event | null;

					if (!event) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "Event not found" }), {
								status: 404,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					return addCorsHeaders(Response.json(event));
				} catch (error) {
					console.error("Get event error:", error);
					return addCorsHeaders(
						new Response(
							JSON.stringify({ error: "Failed to retrieve event" }),
							{ status: 500, headers: { "Content-Type": "application/json" } },
						),
					);
				}
			},
		},

		"/events/:id/update": {
			PUT: async (req) => {
				try {
					const { id } = req.params;
					const {
						title,
						description,
						date,
						location,
						image_url,
						creator_email,
					} = await req.json();

					if (!id) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "Event ID is required" }), {
								status: 400,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					// Get the existing event
					const existingEvent = db
						.query("SELECT * FROM events WHERE id = ?")
						.get(id) as Event | null;

					if (!existingEvent) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "Event not found" }), {
								status: 404,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					// Check if the user is the creator of the event
					if (creator_email !== existingEvent.creator_email) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({
									error: "Not authorized to update this event",
								}),
								{
									status: 403,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Update the event
					db.query(
						"UPDATE events SET title = ?, description = ?, date = ?, location = ?, image_url = ? WHERE id = ?",
					).run(
						title || existingEvent.title,
						description !== undefined ? description : existingEvent.description,
						date || existingEvent.date,
						location !== undefined ? location : existingEvent.location,
						image_url !== undefined ? image_url : existingEvent.image_url,
						id,
					);

					// Get the updated event
					const updatedEvent = db
						.query("SELECT * FROM events WHERE id = ?")
						.get(id) as Event;

					return addCorsHeaders(Response.json(updatedEvent));
				} catch (error) {
					console.error("Update event error:", error);
					return addCorsHeaders(
						new Response(JSON.stringify({ error: "Failed to update event" }), {
							status: 500,
							headers: { "Content-Type": "application/json" },
						}),
					);
				}
			},
		},

		"/events/:id/delete": {
			DELETE: async (req) => {
				try {
					const { id } = req.params;
					const { creator_email } = await req.json();

					if (!id) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "Event ID is required" }), {
								status: 400,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					// Get the existing event
					const existingEvent = db
						.query("SELECT * FROM events WHERE id = ?")
						.get(id) as Event | null;

					if (!existingEvent) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "Event not found" }), {
								status: 404,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					// Check if the user is the creator of the event
					if (creator_email !== existingEvent.creator_email) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({
									error: "Not authorized to delete this event",
								}),
								{
									status: 403,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Delete the event
					db.query("DELETE FROM events WHERE id = ?").run(id);

					return addCorsHeaders(
						Response.json({
							success: true,
							message: "Event deleted successfully",
						}),
					);
				} catch (error) {
					console.error("Delete event error:", error);
					return addCorsHeaders(
						new Response(JSON.stringify({ error: "Failed to delete event" }), {
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
