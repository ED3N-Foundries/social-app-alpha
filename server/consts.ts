export const SERVER_PORT = 3000;
export const SERVER_HOST_URI = `http://localhost:${SERVER_PORT}`;
export const SERVER_WALLET_EMAIL = "REDACTED@gmail.com";
export const CLIENT_PREVIEW_PORT = 5173;
export const CLIENT_DEV_PORT = 5174;

// Route constructors for client use
export const Routes = {
	health: () => "/health",
	metalLogin: () => "/metal/login",
	metalUser: (email: string) => `/metal/user/${encodeURIComponent(email)}`,
	metalHolderBalance: (email: string) =>
		`/metal/holder/${encodeURIComponent(email)}/balance`,
	ensSetName: () => "/ens/set-name",
	metalUsers: () => "/metal/users",
	// Event API routes
	events: () => "/events",
	event: (id: string) => `/events/${id}`,
	createEvent: () => "/events/create",
	updateEvent: (id: string) => `/events/${id}/update`,
	deleteEvent: (id: string) => `/events/${id}/delete`,
	// Event attendee routes
	joinEvent: (id: string) => `/events/${id}/join`,
	getEventAttendees: (id: string) => `/events/${id}/attendees`,
	approveAttendee: (id: string) => `/events/${id}/approve-attendee`,
	rejectAttendee: (id: string) => `/events/${id}/reject-attendee`,
};
