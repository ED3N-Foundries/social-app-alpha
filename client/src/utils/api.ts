import { Routes, SERVER_HOST_URI } from "../../../server/consts";
import type { Event } from "../../../server/server";

// Fetch all events
export async function fetchEvents(): Promise<Event[]> {
	try {
		const response = await fetch(`${SERVER_HOST_URI}${Routes.events()}`);
		if (!response.ok) {
			throw new Error("Failed to fetch events");
		}
		return await response.json();
	} catch (error) {
		console.error("API error fetching events:", error);
		throw error;
	}
}

// Fetch a single event by ID
export async function fetchEvent(id: string): Promise<Event> {
	try {
		const response = await fetch(`${SERVER_HOST_URI}${Routes.event(id)}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch event with id ${id}`);
		}
		return await response.json();
	} catch (error) {
		console.error(`API error fetching event ${id}:`, error);
		throw error;
	}
}

// Create a new event
export async function createEvent(
	eventData: Omit<Event, "id" | "created_at">,
): Promise<Event> {
	try {
		const response = await fetch(`${SERVER_HOST_URI}${Routes.createEvent()}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(eventData),
		});

		if (!response.ok) {
			throw new Error("Failed to create event");
		}

		return await response.json();
	} catch (error) {
		console.error("API error creating event:", error);
		throw error;
	}
}
