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

// Update an existing event
export async function updateEvent(
	id: number,
	eventData: Partial<Omit<Event, "id" | "created_at">>,
	creatorEmail: string,
): Promise<Event> {
	try {
		const response = await fetch(
			`${SERVER_HOST_URI}${Routes.updateEvent(id.toString())}`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...eventData,
					creator_email: creatorEmail,
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to update event with id ${id}`);
		}

		return await response.json();
	} catch (error) {
		console.error(`API error updating event ${id}:`, error);
		throw error;
	}
}

// Delete an event
export async function deleteEvent(
	id: number,
	creatorEmail: string,
): Promise<void> {
	try {
		const response = await fetch(
			`${SERVER_HOST_URI}${Routes.deleteEvent(id.toString())}`,
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					creator_email: creatorEmail,
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to delete event with id ${id}`);
		}
	} catch (error) {
		console.error(`API error deleting event ${id}:`, error);
		throw error;
	}
}
