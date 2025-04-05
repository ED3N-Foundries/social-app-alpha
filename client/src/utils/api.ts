import { Routes, SERVER_HOST_URI } from "../../../server/consts";
import type { Event, EventAttendee } from "../../../server/server";

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
export async function fetchEvent(
	id: string,
): Promise<Event & { attendees?: EventAttendee[] }> {
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
	eventData: Omit<
		Event,
		"id" | "created_at" | "total_staked" | "pending_stake"
	>,
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
	eventData: Partial<
		Omit<Event, "id" | "created_at" | "total_staked" | "pending_stake">
	>,
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

// Join an event
export async function joinEvent(
	eventId: number,
	attendeeEmail: string,
): Promise<{ success: boolean; message: string }> {
	try {
		const response = await fetch(
			`${SERVER_HOST_URI}${Routes.joinEvent(eventId.toString())}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					attendee_email: attendeeEmail,
				}),
			},
		);

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(
				errorData.error || `Failed to join event with id ${eventId}`,
			);
		}

		return await response.json();
	} catch (error) {
		console.error(`API error joining event ${eventId}:`, error);
		throw error;
	}
}

// Get event attendees
export async function getEventAttendees(
	eventId: number,
): Promise<(EventAttendee & { wallet_address: string })[]> {
	try {
		const response = await fetch(
			`${SERVER_HOST_URI}${Routes.getEventAttendees(eventId.toString())}`,
		);

		if (!response.ok) {
			throw new Error(`Failed to get attendees for event with id ${eventId}`);
		}

		return await response.json();
	} catch (error) {
		console.error(`API error getting attendees for event ${eventId}:`, error);
		throw error;
	}
}

// Approve an event attendee
export async function approveAttendee(
	eventId: number,
	attendeeEmail: string,
	creatorEmail: string,
): Promise<{ success: boolean; message: string }> {
	try {
		const response = await fetch(
			`${SERVER_HOST_URI}${Routes.approveAttendee(eventId.toString())}`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					attendee_email: attendeeEmail,
					creator_email: creatorEmail,
				}),
			},
		);

		if (!response.ok) {
			throw new Error(
				`Failed to approve attendee for event with id ${eventId}`,
			);
		}

		return await response.json();
	} catch (error) {
		console.error(`API error approving attendee for event ${eventId}:`, error);
		throw error;
	}
}

// Reject an event attendee
export async function rejectAttendee(
	eventId: number,
	attendeeEmail: string,
	creatorEmail: string,
): Promise<{ success: boolean; message: string }> {
	try {
		const response = await fetch(
			`${SERVER_HOST_URI}${Routes.rejectAttendee(eventId.toString())}`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					attendee_email: attendeeEmail,
					creator_email: creatorEmail,
				}),
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to reject attendee for event with id ${eventId}`);
		}

		return await response.json();
	} catch (error) {
		console.error(`API error rejecting attendee for event ${eventId}:`, error);
		throw error;
	}
}
