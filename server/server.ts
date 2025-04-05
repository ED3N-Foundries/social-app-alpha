// Import required Bun modules
import { serve } from "bun";
import { Database } from "bun:sqlite";
import {
	SERVER_PORT,
	SERVER_WALLET_EMAIL,
	ED3N_TOKEN_SYMBOL,
	ED3N_TOKEN_ADDRESS,
	ED3N_INITIAL_GRANT,
} from "./consts";
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
	pending_attendees: number;
	approved_attendees: number;
	rejected_attendees: number;
	stake_amount: number; // Represents attendee limit
	total_staked: number; // Represents approved attendees count
	pending_stake: number; // Represents pending attendees count
}

export interface EventAttendee {
	id?: number;
	event_id: number;
	attendee_email: string;
	status: "pending" | "approved" | "rejected";
	stake_amount: number; // Fixed at 1 ED3N token per attendee
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
    stake_amount REAL DEFAULT 0,
    total_staked REAL DEFAULT 0,
    pending_stake REAL DEFAULT 0,
    FOREIGN KEY (creator_email) REFERENCES users(email)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS event_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    attendee_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    stake_amount REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (attendee_email) REFERENCES users(email),
    UNIQUE(event_id, attendee_email)
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

// Helper function to ensure system wallet exists
async function ensureSystemWallet() {
	if (!METAL_API_PRIVATE_KEY) {
		throw new Error("METAL_API_PRIVATE_KEY is not set");
	}

	try {
		// First check if system wallet already exists
		const user = db
			.query("SELECT * FROM users WHERE email = ?")
			.get(SERVER_WALLET_EMAIL) as User | null;

		if (user) {
			return user.wallet_address;
		}

		// Create a new holder with Metal API for the system wallet
		const response = await fetch(
			`${METAL_API_URL_BASE}/holder/${encodeURIComponent(SERVER_WALLET_EMAIL)}?privateKey=${METAL_API_PRIVATE_KEY}`,
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

		// Save the system wallet address in the database
		db.query(
			"INSERT INTO users (email, wallet_address, created_at) VALUES (?, ?, ?)",
		).run(SERVER_WALLET_EMAIL, holder.address, new Date().toISOString());

		console.log(`System wallet created with address: ${holder.address}`);
		return holder.address;
	} catch (error) {
		console.error("Error ensuring system wallet:", error);
		throw error;
	}
}

// Helper function to distribute initial token grant to new users
async function distributeInitialTokens(userEmail: string) {
	if (!METAL_API_PRIVATE_KEY) {
		throw new Error("METAL_API_PRIVATE_KEY is not set");
	}

	try {
		// Get user wallet address
		const user = db
			.query("SELECT * FROM users WHERE email = ?")
			.get(userEmail) as User | null;

		if (!user || !user.wallet_address) {
			throw new Error("User wallet address not found");
		}

		// Use the distribute endpoint directly
		const response = await fetch(
			`${METAL_API_URL_BASE}/token/${ED3N_TOKEN_ADDRESS}/distribute`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": METAL_API_PRIVATE_KEY,
				},
				body: JSON.stringify({
					sendTo: user.wallet_address,
					amount: ED3N_INITIAL_GRANT,
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`Metal API error: ${response.status}`);
		}

		const distributionResult = await response.json();

		console.log(
			`Distributed ${ED3N_INITIAL_GRANT} ${ED3N_TOKEN_SYMBOL} to new user ${userEmail}:`,
			distributionResult,
		);
		return distributionResult;
	} catch (error) {
		console.error(
			`Failed to distribute initial ${ED3N_TOKEN_SYMBOL} tokens to ${userEmail}:`,
			error,
		);
		throw error;
	}
}

// Helper function for Metal API token transfers
async function transferTokens(
	fromEmail: string,
	toEmail: string,
	amount: number,
	reference: string,
) {
	if (!METAL_API_PRIVATE_KEY) {
		throw new Error("METAL_API_PRIVATE_KEY is not set");
	}

	try {
		const response = await fetch(
			`${METAL_API_URL_BASE}/tokens/transfer?privateKey=${METAL_API_PRIVATE_KEY}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": METAL_API_PRIVATE_KEY,
				},
				body: JSON.stringify({
					fromHolderId: fromEmail,
					toHolderId: toEmail,
					tokenAddress: ED3N_TOKEN_ADDRESS,
					amount: amount.toString(),
					reference: reference,
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`Metal API error: ${response.status}`);
		}

		return await response.json();
	} catch (error) {
		console.error("Error transferring tokens:", error);
		throw error;
	}
}

// Start the server
serve({
	port: SERVER_PORT,
	async fetch(req, server) {
		// Ensure system wallet exists when server starts
		try {
			await ensureSystemWallet();
			console.log("System wallet is ready");
		} catch (error) {
			console.error("Failed to initialize system wallet:", error);
		}

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
					// Create a new holder with Metal API - using email as the holder ID
					try {
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

						// Distribute initial tokens to the new user - After user is created and saved
						try {
							await distributeInitialTokens(email);
						} catch (tokenError) {
							console.error("Error distributing initial tokens:", tokenError);
							// We'll still return success even if token distribution fails
							// The user account is created, but they might not have received tokens
						}
					} catch (error) {
						console.error("Error creating wallet:", error);
						throw error;
					}

					return addCorsHeaders(
						Response.json({
							success: true,
							email: user.email,
							wallet_address: user.wallet_address,
							initial_grant: ED3N_INITIAL_GRANT,
							token_symbol: ED3N_TOKEN_SYMBOL,
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
						stake_amount,
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
							`INSERT INTO events (
                title, description, date, location, image_url, creator_email, created_at, stake_amount
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
						)
						.run(
							title,
							description || "",
							date,
							location || "",
							image_url || "",
							creator_email,
							new Date().toISOString(),
							stake_amount || 0,
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

					// Get attendees for this event
					const attendees = db
						.query("SELECT * FROM event_attendees WHERE event_id = ?")
						.all(id) as EventAttendee[];

					return addCorsHeaders(
						Response.json({
							...event,
							attendees,
						}),
					);
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
						stake_amount,
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
						`UPDATE events SET 
              title = ?, 
              description = ?, 
              date = ?, 
              location = ?, 
              image_url = ?,
              stake_amount = ?
            WHERE id = ?`,
					).run(
						title || existingEvent.title,
						description !== undefined ? description : existingEvent.description,
						date || existingEvent.date,
						location !== undefined ? location : existingEvent.location,
						image_url !== undefined ? image_url : existingEvent.image_url,
						stake_amount !== undefined
							? stake_amount
							: existingEvent.stake_amount,
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

		// Event attendee endpoints
		"/events/:id/join": {
			POST: async (req) => {
				try {
					const { id } = req.params;
					const { attendee_email } = await req.json();

					if (!id || !attendee_email) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({
									error: "Event ID and attendee email are required",
								}),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Get the event
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

					// Check if the event has reached its attendee limit
					const approvedCount = db
						.query(
							"SELECT COUNT(*) as count FROM event_attendees WHERE event_id = ? AND status = 'approved'",
						)
						.get(id) as { count: number };

					const pendingCount = db
						.query(
							"SELECT COUNT(*) as count FROM event_attendees WHERE event_id = ? AND status = 'pending'",
						)
						.get(id) as { count: number };

					const totalCount = approvedCount.count + pendingCount.count;

					if (event.stake_amount > 0 && totalCount >= event.stake_amount) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({
									error: "Event has reached its attendee limit",
								}),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Check if user is already an attendee
					const existingAttendee = db
						.query(
							"SELECT * FROM event_attendees WHERE event_id = ? AND attendee_email = ?",
						)
						.get(id, attendee_email) as EventAttendee | null;

					if (existingAttendee) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({ error: "Already joined this event" }),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Add attendee to the event with pending status
					db.query(
						`INSERT INTO event_attendees (
							event_id, attendee_email, status, stake_amount, created_at
						) VALUES (?, ?, ?, ?, ?)`,
					).run(
						id,
						attendee_email,
						"pending",
						event.stake_amount, // Amount to stake
						new Date().toISOString(),
					);

					// Update the event's pending stake amount - now incrementing attendee count
					db.query(
						"UPDATE events SET pending_stake = pending_stake + 1 WHERE id = ?",
					).run(id);

					// Implement Metal API token staking
					// Transfer tokens from the attendee to the system wallet (not to the event creator)
					if (event.stake_amount > 0) {
						try {
							// Ensure system wallet exists
							await ensureSystemWallet();

							// Transfer tokens from attendee to system wallet (escrow)
							// Note: We stake a fixed 1 ED3N token regardless of event.stake_amount
							// event.stake_amount is used only as attendee limit
							const stakeResult = await transferTokens(
								attendee_email,
								SERVER_WALLET_EMAIL, // Using system wallet as escrow
								event.stake_amount, // Amount to stake
								`Stake for event ${id}`,
							);

							console.log(
								`${ED3N_TOKEN_SYMBOL} staking completed:`,
								stakeResult,
							);
						} catch (error) {
							console.error(`${ED3N_TOKEN_SYMBOL} staking failed:`, error);
							// We will still allow the user to join but log the error
							// In a production system, you might want to roll back the join if the staking fails
						}
					}

					return addCorsHeaders(
						Response.json({
							success: true,
							message: "Successfully joined the event",
						}),
					);
				} catch (error) {
					console.error("Join event error:", error);
					return addCorsHeaders(
						new Response(JSON.stringify({ error: "Failed to join event" }), {
							status: 500,
							headers: { "Content-Type": "application/json" },
						}),
					);
				}
			},
		},

		"/events/:id/attendees": {
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

					// Get the attendees for this event
					const attendees = db
						.query(`
              SELECT ea.*, u.wallet_address
              FROM event_attendees ea
              JOIN users u ON ea.attendee_email = u.email
              WHERE ea.event_id = ?
            `)
						.all(id) as (EventAttendee & { wallet_address: string })[];

					return addCorsHeaders(Response.json(attendees));
				} catch (error) {
					console.error("Get attendees error:", error);
					return addCorsHeaders(
						new Response(
							JSON.stringify({ error: "Failed to retrieve attendees" }),
							{ status: 500, headers: { "Content-Type": "application/json" } },
						),
					);
				}
			},
		},

		"/events/:id/approve-attendee": {
			PUT: async (req) => {
				try {
					const { id } = req.params;
					const { attendee_email, creator_email } = await req.json();

					if (!id || !attendee_email || !creator_email) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({
									error:
										"Event ID, attendee email, and creator email are required",
								}),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Get the event
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

					// Check if user is the event creator
					if (creator_email !== event.creator_email) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({
									error: "Only the event creator can approve attendees",
								}),
								{
									status: 403,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Get the attendee
					const attendee = db
						.query(
							"SELECT * FROM event_attendees WHERE event_id = ? AND attendee_email = ?",
						)
						.get(id, attendee_email) as EventAttendee | null;

					if (!attendee) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "Attendee not found" }), {
								status: 404,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					// Update attendee status to approved
					db.query(
						"UPDATE event_attendees SET status = 'approved' WHERE event_id = ? AND attendee_email = ?",
					).run(id, attendee_email);

					// Update the event's staking amounts - now updating attendee counts
					db.query(`
						UPDATE events SET 
						pending_stake = pending_stake - ?,
						total_staked = total_staked + ?
						WHERE id = ?
					`).run(event.stake_amount, event.stake_amount, id);

					// In the updated flow, we're not transferring tokens from the system wallet
					// when approving - we keep them there until the event is completed
					// or the attendee is rejected
					if (event.stake_amount > 0) {
						try {
							// Just log the approval, tokens remain in system wallet
							// Note: The fixed 1 ED3N token that was staked remains in the system wallet
							console.log(
								`Stake confirmed for attendee ${attendee_email} in event ${id}. Tokens remain in system wallet.`,
							);
						} catch (error) {
							console.error("Stake confirmation failed:", error);
						}
					}

					return addCorsHeaders(
						Response.json({
							success: true,
							message: "Attendee approved successfully",
						}),
					);
				} catch (error) {
					console.error("Approve attendee error:", error);
					return addCorsHeaders(
						new Response(
							JSON.stringify({ error: "Failed to approve attendee" }),
							{ status: 500, headers: { "Content-Type": "application/json" } },
						),
					);
				}
			},
		},

		"/events/:id/reject-attendee": {
			PUT: async (req) => {
				try {
					const { id } = req.params;
					const { attendee_email, creator_email } = await req.json();

					if (!id || !attendee_email || !creator_email) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({
									error:
										"Event ID, attendee email, and creator email are required",
								}),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Get the event
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

					// Check if user is the event creator
					if (creator_email !== event.creator_email) {
						return addCorsHeaders(
							new Response(
								JSON.stringify({
									error: "Only the event creator can reject attendees",
								}),
								{
									status: 403,
									headers: { "Content-Type": "application/json" },
								},
							),
						);
					}

					// Get the attendee
					const attendee = db
						.query(
							"SELECT * FROM event_attendees WHERE event_id = ? AND attendee_email = ?",
						)
						.get(id, attendee_email) as EventAttendee | null;

					if (!attendee) {
						return addCorsHeaders(
							new Response(JSON.stringify({ error: "Attendee not found" }), {
								status: 404,
								headers: { "Content-Type": "application/json" },
							}),
						);
					}

					// Update attendee status to rejected
					db.query(
						"UPDATE event_attendees SET status = 'rejected' WHERE event_id = ? AND attendee_email = ?",
					).run(id, attendee_email);

					// Update the event's pending stake amount - now updating attendee count
					db.query(
						"UPDATE events SET pending_stake = pending_stake - 1 WHERE id = ?",
					).run(id);

					// Implement Metal API refund
					// When rejecting, we return tokens from system wallet to the attendee
					if (event.stake_amount > 0) {
						try {
							// Ensure system wallet exists
							await ensureSystemWallet();

							// Refund the stakes from system wallet back to the attendee
							// Note: We refund the fixed 1 ED3N token that was staked
							const refundResult = await transferTokens(
								SERVER_WALLET_EMAIL, // From system wallet
								attendee_email, // To the attendee
								event.stake_amount, // Amount to refund
								`Refund for event ${id}`,
							);

							console.log(
								`${ED3N_TOKEN_SYMBOL} refund completed:`,
								refundResult,
							);
						} catch (error) {
							console.error(`${ED3N_TOKEN_SYMBOL} refund failed:`, error);
							// We will still reject the attendee but log the error
						}
					}

					return addCorsHeaders(
						Response.json({
							success: true,
							message: "Attendee rejected successfully",
						}),
					);
				} catch (error) {
					console.error("Reject attendee error:", error);
					return addCorsHeaders(
						new Response(
							JSON.stringify({ error: "Failed to reject attendee" }),
							{ status: 500, headers: { "Content-Type": "application/json" } },
						),
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
