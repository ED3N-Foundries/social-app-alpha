export const SERVER_PORT = 3000;
export const SERVER_HOST_URI = `http://localhost:${SERVER_PORT}`;
export const CLIENT_PREVIEW_PORT = 5173;
export const CLIENT_DEV_PORT = 5174;

// Token configuration
export const ED3N_TOKEN_SYMBOL = "ED3N";
export const ED3N_TOKEN_ADDRESS = "0x36bb8e8d361b0e487869270fbfea6924498a4bc3";

// Polygon configuration
export const POLYGON_RPC_URL = "https://polygon-rpc.com";
export const POLYGON_CONTRACT_ADDRESS =
	"0xC28f7C1eB56312271B74B1332495F4231936F61b";

// Route constructors for client use
export const Routes = {
	health: () => "/health",
	metalLogin: () => "/metal/login",
	metalUser: (email: string) => `/metal/user/${encodeURIComponent(email)}`,
	metalHolderBalance: (email: string) =>
		`/metal/holder/${encodeURIComponent(email)}/balance`,
	distributeTokens: () => "/metal/distribute-tokens",
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
