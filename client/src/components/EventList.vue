<template>
  <div class="event-list">
    <div class="fixed-header">
      <v-container>
        <h2 class="text-h4 mb-4">Upcoming Events</h2>
      </v-container>
    </div>

    <div class="scrollable-content">
      <v-container>
        <!-- No events message -->
        <v-card
          v-if="!events.length && !loading"
          class="mx-auto pa-4 text-center"
        >
          <v-card-text>
            <p class="text-h6">No events found</p>
            <p>Create your first event by clicking the + button</p>
          </v-card-text>
        </v-card>

        <!-- Loading indicator -->
        <div v-if="loading" class="d-flex justify-center my-4">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
        </div>

        <!-- Events list -->
        <v-row v-if="events.length">
          <v-col
            v-for="event in events"
            :key="event.id"
            cols="12"
          >
            <v-fade-transition leave-absolute>
              <!-- Event View Card -->
              <v-card v-if="editingEventId !== event.id" class="mx-auto">
                <v-img
                  v-if="event.image_url"
                  :src="event.image_url"
                  height="200"
                  cover
                  class="align-end"
                >
                  <template v-slot:placeholder>
                    <v-row class="fill-height ma-0" align="center" justify="center">
                      <v-progress-circular indeterminate color="grey-lighten-5"></v-progress-circular>
                    </v-row>
                  </template>
                </v-img>
                <v-card-title>{{ event.title }}</v-card-title>
                <v-card-subtitle>
                  <v-icon small class="mr-1">mdi-calendar</v-icon>
                  {{ formatDate(event.date) }}
                  <v-icon small class="ml-3 mr-1">mdi-map-marker</v-icon>
                  {{ event.location || 'Location TBD' }}
                </v-card-subtitle>
                <v-card-text>
                  {{ event.description || 'No description provided' }}
                </v-card-text>

                <!-- Attendee limit progress -->
                <v-card-text v-if="event.stake_amount > 0">
                  <div class="d-flex align-center mb-1">
                    <span class="text-subtitle-2 mr-2">Attendee Limit: {{ event.stake_amount }}</span>
                    <v-spacer></v-spacer>
                    <span class="text-subtitle-2">
                      {{ getApprovedCount(event) }} approved / {{ getPendingCount(event) }} pending
                    </span>
                  </div>

                  <v-progress-linear
                    height="8"
                    rounded
                  >
                    <template v-slot:default>
                      <div class="custom-progress-container">
                        <div
                          class="custom-progress-value-staked"
                          :style="{ width: `${(getApprovedCount(event) / (event.stake_amount || 1)) * 100}%` }"
                        ></div>
                        <div
                          class="custom-progress-value-pending"
                          :style="{ width: `${(getPendingCount(event) / (event.stake_amount || 1)) * 100}%` }"
                        ></div>
                      </div>
                    </template>
                  </v-progress-linear>

                  <div class="d-flex align-center mt-1">
                    <span class="text-caption"><v-icon small color="success">mdi-check</v-icon> Approved</span>
                    <v-spacer></v-spacer>
                    <span class="text-caption"><v-icon small color="warning">mdi-clock</v-icon> Pending</span>
                  </div>
                </v-card-text>

                <!-- Staking information -->
                <v-card-text v-if="event.stake_amount > 0">
                  <v-alert
                    color="info"
                    icon="mdi-information"
                    variant="tonal"
                    class="my-1"
                    density="compact"
                  >
                    Joining this event requires staking {{ event.stake_amount }} $ED3N tokens
                  </v-alert>
                </v-card-text>

                <!-- Attendees section -->
                <v-card-text>
                  <v-expansion-panels>
                    <v-expansion-panel>
                      <v-expansion-panel-title>
                        <div class="d-flex align-center">
                          <v-icon left>mdi-account-group</v-icon>
                          <span>Attendees ({{ event.attendees ? event.attendees.length : 0 }})</span>
                        </div>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <div v-if="!event.attendees || event.attendees.length === 0" class="text-center pa-4">
                          <p class="text-body-1">No attendees yet</p>
                        </div>
                        <v-list v-else>
                          <v-list-item
                            v-for="attendee in event.attendees"
                            :key="attendee.id"
                          >
                            <template v-slot:prepend>
                              <v-avatar color="primary" size="36">
                                {{ getInitial(attendee.attendee_email || '') }}
                              </v-avatar>
                            </template>

                            <v-list-item-title>{{ attendee.attendee_email }}</v-list-item-title>
                            <v-list-item-subtitle>
                              <v-chip
                                size="small"
                                :color="getStatusColor(attendee.status)"
                              >
                                {{ attendee.status }}
                              </v-chip>
                            </v-list-item-subtitle>

                            <!-- Approve/Reject buttons with opposing button disabled -->
                            <template v-slot:append v-if="canEditEvent(event) && attendee.status === 'pending'">
                              <v-btn
                                icon="mdi-check"
                                variant="text"
                                color="success"
                                size="small"
                                :loading="loadingApprove[`${event.id}-${attendee.attendee_email}`]"
                                :disabled="loadingReject[`${event.id}-${attendee.attendee_email}`]"
                                @click="approveAttendeeHandler(event.id as number, attendee.attendee_email)"
                              ></v-btn>
                              <v-btn
                                icon="mdi-close"
                                variant="text"
                                color="error"
                                size="small"
                                :loading="loadingReject[`${event.id}-${attendee.attendee_email}`]"
                                :disabled="loadingApprove[`${event.id}-${attendee.attendee_email}`]"
                                @click="rejectAttendeeHandler(event.id as number, attendee.attendee_email)"
                              ></v-btn>
                            </template>
                          </v-list-item>
                        </v-list>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </v-card-text>

                <v-card-actions>
                  <v-btn
                    v-if="!canEditEvent(event) && !hasJoinedEvent(event)"
                    variant="text"
                    color="primary"
                    @click="showJoinEventDialog = true; eventToJoin = event"
                  >
                    <v-icon class="mr-1">mdi-account-plus</v-icon>
                    Join
                  </v-btn>
                  <v-spacer></v-spacer>
                  <v-btn
                    v-if="canEditEvent(event)"
                    variant="text"
                    color="error"
                    @click="confirmDeleteEvent(event)"
                  >
                    <v-icon class="mr-1">mdi-delete</v-icon>
                    Delete
                  </v-btn>
                  <v-btn
                    v-if="canEditEvent(event)"
                    variant="text"
                    color="secondary"
                    @click="startEditingEvent(event)"
                  >
                    <v-icon class="mr-1">mdi-pencil</v-icon>
                    Edit
                  </v-btn>
                </v-card-actions>
              </v-card>

              <!-- Event Edit Card -->
              <v-card v-else class="mx-auto">
                <v-card-title>Edit Event</v-card-title>
                <v-card-text>
                  <v-form ref="editForm" v-model="editFormValid" @submit.prevent="updateEventHandler">
                    <v-text-field
                      v-model="editingEvent.title"
                      label="Event Title"
                      required
                      :rules="[(v: string) => !!v || 'Title is required']"
                    ></v-text-field>

                    <v-textarea
                      v-model="editingEvent.description"
                      label="Description"
                      rows="3"
                    ></v-textarea>

                    <v-text-field
                      v-model="editingEvent.date"
                      label="Date"
                      type="datetime-local"
                      required
                      :rules="[(v: string) => !!v || 'Date is required']"
                    ></v-text-field>

                    <v-text-field
                      v-model="editingEvent.location"
                      label="Location"
                    ></v-text-field>

                    <v-text-field
                      v-model="editingEvent.image_url"
                      label="Image URL"
                      hint="Enter a URL for the event image"
                    ></v-text-field>

                    <v-text-field
                      v-model.number="editingEvent.stake_amount"
                      label="Stake Amount"
                      type="number"
                      min="0"
                      :rules="[(v: number) => v >= 0 || 'Limit must be a positive number']"
                      hint="Amount of $ED3N tokens required to attend this event"
                    ></v-text-field>

                    <v-text-field
                      v-model.number="editingEvent.attendee_limit"
                      label="Attendee Limit"
                      type="number"
                      min="0"
                      :rules="[(v: number) => v >= 0 || 'Limit must be a positive number']"
                      hint="Maximum number of attendees allowed for this event"
                    ></v-text-field>
                  </v-form>
                </v-card-text>
                <v-card-actions>
                  <v-btn
                    color="error"
                    variant="text"
                    @click="cancelEditing"
                  >
                    Cancel
                  </v-btn>
                  <v-spacer></v-spacer>
                  <v-btn
                    color="primary"
                    variant="text"
                    @click="updateEventHandler"
                    :disabled="!editFormValid"
                  >
                    Save Changes
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-fade-transition>
          </v-col>
        </v-row>
      </v-container>
    </div>

    <!-- Floating Action Button -->
    <v-btn
      class="float-btn"
      color="primary"
      icon
      size="large"
      @click="showCreateEventDialog = true"
    >
      <v-icon>mdi-plus</v-icon>
    </v-btn>

    <!-- Create Event Dialog -->
    <v-dialog v-model="showCreateEventDialog" max-width="600px">
      <v-card>
        <v-card-title>Create New Event</v-card-title>
        <v-card-text>
          <v-form ref="form" v-model="valid" @submit.prevent="createEventHandler">
            <v-text-field
              v-model="newEvent.title"
              label="Event Title"
              required
              :rules="[(v: string) => !!v || 'Title is required']"
            ></v-text-field>

            <v-textarea
              v-model="newEvent.description"
              label="Description"
              rows="3"
            ></v-textarea>

            <v-text-field
              v-model="newEvent.date"
              label="Date"
              type="datetime-local"
              required
              :rules="[(v: string) => !!v || 'Date is required']"
            ></v-text-field>

            <v-text-field
              v-model="newEvent.location"
              label="Location"
            ></v-text-field>

            <v-text-field
              v-model="newEvent.image_url"
              label="Image URL"
              hint="Enter a URL for the event image"
            ></v-text-field>

            <v-text-field
              v-model.number="newEvent.stake_amount"
              label="Stake Amount"
              type="number"
              min="0"
              :rules="[(v: number) => v >= 0 || 'Limit must be a positive number']"
              hint="Amount of $ED3N tokens required to attend this event"
            ></v-text-field>

            <v-text-field
              v-model.number="newEvent.attendee_limit"
              label="Attendee Limit"
              type="number"
              min="0"
              :rules="[(v: number) => v >= 0 || 'Limit must be a positive number']"
              hint="Maximum number of attendees allowed for this event"
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="error"
            variant="text"
            @click="showCreateEventDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="text"
            @click="createEventHandler"
            :disabled="!valid"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Join Event Dialog with loading state -->
    <v-bottom-sheet v-model="showJoinEventDialog">
      <v-card :loading="joiningEvent">
        <v-card-title>Join Event</v-card-title>
        <v-card-text>
          <p>You are about to join the event <strong>{{ eventToJoin?.title }}</strong>.</p>

          <v-alert
            v-if="eventToJoin?.attendee_limit"
            color="info"
            icon="mdi-account-group"
            variant="tonal"
            class="my-3"
          >
            This event has a limit of <strong>{{ eventToJoin?.attendee_limit }}</strong> attendees.
            Current status: <strong>{{ getApprovedCount(eventToJoin) }}</strong> approved / <strong>{{ getPendingCount(eventToJoin) }}</strong> pending
          </v-alert>

          <v-alert
            color="warning"
            icon="mdi-currency-usd"
            variant="tonal"
            class="my-3"
          >
            Joining this event requires staking <strong>{{ eventToJoin?.stake_amount }} $ED3N tokens</strong>. This token will be held in escrow until your attendance is approved or rejected.
          </v-alert>

          <p class="text-caption mt-2">By joining, you agree to the event's terms and conditions.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="error"
            variant="text"
            @click="showJoinEventDialog = false"
            :disabled="joiningEvent"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="text"
            @click="joinEventHandler"
            :loading="joiningEvent"
            :disabled="!!eventToJoin?.stake_amount &&
              (getApprovedCount(eventToJoin) + getPendingCount(eventToJoin) >= (eventToJoin?.stake_amount || 0))"
          >
            Confirm Join
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400px">
      <v-card>
        <v-card-title class="text-h5">Delete Event</v-card-title>
        <v-card-text>
          Are you sure you want to delete the event "{{ eventToDelete?.title }}"? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            variant="text"
            @click="showDeleteDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="text"
            @click="deleteEventHandler"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
    >
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="snackbar.show = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, reactive } from "vue";
import { useAppStore } from "@/stores/app";
import type { Event, EventAttendee } from "../../../server/server";
import {
	fetchEvents,
	fetchEvent,
	createEvent as createEventAPI,
	updateEvent as updateEventAPI,
	deleteEvent as deleteEventAPI,
	joinEvent as joinEventAPI,
	approveAttendee as approveAttendeeAPI,
	rejectAttendee as rejectAttendeeAPI,
} from "@/utils/api";

// Extend Event type to include attendees
interface ExtendedEvent extends Event {
	attendees?: EventAttendee[];
}

const appStore = useAppStore();
const events = ref<ExtendedEvent[]>([]);
const loading = ref(true);
const showCreateEventDialog = ref(false);
const valid = ref(false);
const editFormValid = ref(false);
const editingEventId = ref<number | null>(null);
const editingEvent = reactive({
	id: null as number | null,
	title: "",
	description: "",
	date: "",
	location: "",
	image_url: "",
	creator_email: "",
	stake_amount: 0,
	attendee_limit: 0,
});

const newEvent: Omit<
	Event,
	| "id"
	| "created_at"
	| "creator_email"
	| "pending_attendees"
	| "approved_attendees"
	| "rejected_attendees"
	| "total_staked"
	| "pending_stake"
> = reactive({
	title: "Party Time!",
	description: "Come join us for a night of fun and games!",
	date: "2025-05-01T19:00:00",
	location: "123 Main St, Anytown, USA",
	image_url:
		"https://kagi.com/proxy/taipei-101_standard.jpg?c=dhSWYzhKlbCyN8IwKbfpVXp1irNiELvRzmwJSykQI0enLywDINy_LvCz2weAwNpe29XDqjGS6tNZfayCorSiOHu3T-EAadZS3ivuka2l2p-NAksnIrjmGS0Vol6Nomj9DiDAUfcxXKvPL3F_enQ_r7Ph18j_YY4RpRXyJ2_oGH4%3D",
	stake_amount: 20,
	attendee_limit: 10,
});

const showDeleteDialog = ref(false);
const eventToDelete = ref<ExtendedEvent | null>(null);

// Event joining
const showJoinEventDialog = ref(false);
const eventToJoin = ref<ExtendedEvent | null>(null);

// Create a snackbar for notifications
const snackbar = reactive({
	show: false,
	text: "",
	color: "success",
	timeout: 3000,
});

// Helper function to show snackbar notification
const showNotification = (message: string, color = "success") => {
	snackbar.text = message;
	snackbar.color = color;
	snackbar.show = true;
};

// Loading states
const loadingApprove = ref<Record<string, boolean>>({});
const loadingReject = ref<Record<string, boolean>>({});
const joiningEvent = ref(false);

// Fetch events when component is mounted
onMounted(async () => {
	await loadEvents();
});

// Format date for display
const formatDate = (dateString: string) => {
	const date = new Date(dateString);
	return date.toLocaleString();
};

// Get initial for avatar
const getInitial = (email: string) => {
	return email.charAt(0).toUpperCase();
};

// Get status color
const getStatusColor = (status: string) => {
	switch (status) {
		case "approved":
			return "success";
		case "pending":
			return "warning";
		case "rejected":
			return "error";
		default:
			return "grey";
	}
};

// Check if user has already joined the event
const hasJoinedEvent = (event: ExtendedEvent) => {
	if (!appStore.userEmail || !event.attendees) return false;
	return event.attendees.some(
		(a: EventAttendee) => a.attendee_email === appStore.userEmail,
	);
};

// Load events from API
const loadEvents = async () => {
	loading.value = true;
	try {
		events.value = (await fetchEvents()) as ExtendedEvent[];

		// Fetch detailed info for each event to get attendees
		for (const event of events.value) {
			if (event.id) {
				const detailedEvent = await fetchEvent(event.id.toString());
				event.attendees = detailedEvent.attendees;
			}
		}
	} catch (error) {
		console.error("Error loading events:", error);
		showNotification("Failed to load events", "error");
	} finally {
		loading.value = false;
	}
};

// Create a new event
const createEventHandler = async () => {
	if (!appStore.userEmail) {
		showNotification("User not logged in", "error");
		return;
	}

	try {
		const createdEvent = await createEventAPI({
			...newEvent,
			creator_email: appStore.userEmail,
		});

		events.value.unshift(createdEvent as ExtendedEvent);

		// Show success notification
		showNotification("Event created successfully");

		// Reset form
		newEvent.title = "";
		newEvent.description = "";
		newEvent.date = "";
		newEvent.location = "";
		newEvent.image_url = "";
		newEvent.stake_amount = 0;
		showCreateEventDialog.value = false;
	} catch (error) {
		console.error("Error creating event:", error);
		showNotification("Failed to create event", "error");
	}
};

// Check if the current user can edit an event
const canEditEvent = (event: Event) => {
	return appStore.userEmail && appStore.userEmail === event.creator_email;
};

// Start editing an event
const startEditingEvent = (event: ExtendedEvent) => {
	if (!canEditEvent(event)) return;

	editingEventId.value = event.id as number;
	editingEvent.id = event.id as number;
	editingEvent.title = event.title;
	editingEvent.description = event.description;
	editingEvent.date = event.date;
	editingEvent.location = event.location;
	editingEvent.image_url = event.image_url || "";
	editingEvent.creator_email = event.creator_email;
	editingEvent.stake_amount = event.stake_amount || 0;
	editingEvent.attendee_limit = event.attendee_limit || 0;
};

// Cancel editing
const cancelEditing = () => {
	editingEventId.value = null;
	editFormValid.value = false;
};

// Update an event
const updateEventHandler = async () => {
	if (!editingEvent.id || !appStore.userEmail) return;

	try {
		const updatedEvent = await updateEventAPI(
			editingEvent.id,
			{
				title: editingEvent.title,
				description: editingEvent.description,
				date: editingEvent.date,
				location: editingEvent.location,
				image_url: editingEvent.image_url,
				stake_amount: editingEvent.stake_amount,
				attendee_limit: editingEvent.attendee_limit,
			},
			appStore.userEmail,
		);

		// Update the event in the local array
		const index = events.value.findIndex((e) => e.id === updatedEvent.id);
		if (index !== -1) {
			events.value[index] = updatedEvent as ExtendedEvent;
		}

		// Show success notification
		showNotification("Event updated successfully");

		// Reset editing state
		editingEventId.value = null;
	} catch (error) {
		console.error("Error updating event:", error);
		showNotification("Failed to update event", "error");
	}
};

// Confirm delete event dialog
const confirmDeleteEvent = (event: ExtendedEvent) => {
	if (!canEditEvent(event)) return;

	eventToDelete.value = event;
	showDeleteDialog.value = true;
};

// Delete an event
const deleteEventHandler = async () => {
	if (!eventToDelete.value?.id || !appStore.userEmail) return;

	try {
		await deleteEventAPI(eventToDelete.value.id as number, appStore.userEmail);

		// Remove the event from the local array
		events.value = events.value.filter((e) => e.id !== eventToDelete.value?.id);

		// Show success notification
		showNotification("Event deleted successfully");

		// Close the dialog
		showDeleteDialog.value = false;
		eventToDelete.value = null;
	} catch (error) {
		console.error("Error deleting event:", error);
		showNotification("Failed to delete event", "error");
	}
};

// Join an event
const joinEventHandler = async () => {
	if (!eventToJoin.value?.id || !appStore.userEmail) return;

	// Check if the event is at capacity
	const totalAttendees =
		getApprovedCount(eventToJoin.value) + getPendingCount(eventToJoin.value);
	if (
		eventToJoin.value.stake_amount > 0 &&
		totalAttendees >= eventToJoin.value.stake_amount
	) {
		showNotification("This event has reached its attendee limit.", "error");
		return;
	}

	joiningEvent.value = true;

	try {
		await joinEventAPI(eventToJoin.value.id as number, appStore.userEmail);

		// Refresh token balances after staking
		await appStore.fetchTokenBalance();

		// Refresh the events to get updated attendance
		await loadEvents();

		// Show success notification
		showNotification("Successfully requested to join the event");

		// Close the dialog
		showJoinEventDialog.value = false;
		eventToJoin.value = null;
	} catch (error: unknown) {
		let errorMessage =
			"Failed to request to join event. Please try again later.";
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		console.error("Error requesting to join event:", error);
		showNotification(errorMessage, "error");
	} finally {
		joiningEvent.value = false;
	}
};

// Approve an attendee
const approveAttendeeHandler = async (
	eventId: number,
	attendeeEmail: string,
) => {
	if (!appStore.userEmail) return;

	const key = `${eventId}-${attendeeEmail}`;
	loadingApprove.value[key] = true;

	try {
		await approveAttendeeAPI(eventId, attendeeEmail, appStore.userEmail);

		// Refresh token balances
		await appStore.fetchTokenBalance();

		// Refresh the events to get updated attendance
		await loadEvents();

		// Show success notification
		showNotification(`Attendee ${attendeeEmail} has been approved`);
	} catch (error) {
		console.error("Error approving attendee:", error);
		showNotification("Failed to approve attendee", "error");
	} finally {
		loadingApprove.value[key] = false;
	}
};

// Reject an attendee
const rejectAttendeeHandler = async (
	eventId: number,
	attendeeEmail: string,
) => {
	if (!appStore.userEmail) return;

	const key = `${eventId}-${attendeeEmail}`;
	loadingReject.value[key] = true;

	try {
		await rejectAttendeeAPI(eventId, attendeeEmail, appStore.userEmail);

		// Refresh token balances after refund
		await appStore.fetchTokenBalance();

		// Refresh the events to get updated attendance
		await loadEvents();

		// Show success notification
		showNotification(`Attendee ${attendeeEmail} has been rejected`);
	} catch (error) {
		console.error("Error rejecting attendee:", error);
		showNotification("Failed to reject attendee", "error");
	} finally {
		loadingReject.value[key] = false;
	}
};

// Get approved count
const getApprovedCount = (event: ExtendedEvent | null) => {
	if (!event || !event.attendees) return 0;
	return event.attendees.filter((a) => a.status === "approved").length;
};

// Get pending count
const getPendingCount = (event: ExtendedEvent | null) => {
	if (!event || !event.attendees) return 0;
	return event.attendees.filter((a) => a.status === "pending").length;
};
</script>

<style scoped>
.event-list {
	height: 100vh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.fixed-header {
	position: sticky;
	top: 0;
	z-index: 2;
}

.scrollable-content {
	flex: 1;
	overflow-y: auto;
	padding-bottom: 80px; /* Space for the floating button */
}

.float-btn {
	position: fixed;
	bottom: 80px;
	right: 24px;
	z-index: 5;
}

.custom-progress-container {
	width: 100%;
	height: 8px;
	display: flex;
	border-radius: 4px;
	overflow: hidden;
}

.custom-progress-value-staked {
	height: 100%;
	background-color: #4caf50; /* Green for staked */
}

.custom-progress-value-pending {
	height: 100%;
	background-color: #ff9800; /* Orange for pending */
}
</style>
