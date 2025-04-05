export const SERVER_PORT = 3000;
export const SERVER_HOST_URI = `http://localhost:${SERVER_PORT}`;
export const SERVER_WALLET_EMAIL = "REDACTED@gmail.com";
export const CLIENT_PREVIEW_PORT = 5173;
export const CLIENT_DEV_PORT = 5174;

// Token configuration
export const ED3N_TOKEN_SYMBOL = "ED3N";
export const ED3N_TOKEN_ADDRESS = process.env.ED3N_TOKEN_ADDRESS || "0xED3N";
export const ED3N_INITIAL_GRANT = 1000; // Amount of ED3N tokens to grant new users

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
