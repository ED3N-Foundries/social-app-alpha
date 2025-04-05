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
                <v-card-actions>
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
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, reactive } from "vue";
import { useAppStore } from "@/stores/app";
import type { Event } from "../../../server/server";
import {
	fetchEvents,
	createEvent as createEventAPI,
	updateEvent as updateEventAPI,
	deleteEvent as deleteEventAPI,
} from "@/utils/api";

const appStore = useAppStore();
const events = ref<Event[]>([]);
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
	creator_email: "",
});

const newEvent = reactive({
	title: "",
	description: "",
	date: "",
	location: "",
});

const showDeleteDialog = ref(false);
const eventToDelete = ref<Event | null>(null);

// Fetch events when component is mounted
onMounted(async () => {
	await loadEvents();
});

// Format date for display
const formatDate = (dateString: string) => {
	const date = new Date(dateString);
	return date.toLocaleString();
};

// Load events from API
const loadEvents = async () => {
	loading.value = true;
	try {
		events.value = await fetchEvents();
	} catch (error) {
		console.error("Error loading events:", error);
	} finally {
		loading.value = false;
	}
};

// Create a new event
const createEventHandler = async () => {
	if (!appStore.userEmail) {
		console.error("User not logged in");
		return;
	}

	try {
		const createdEvent = await createEventAPI({
			...newEvent,
			creator_email: appStore.userEmail,
		});

		events.value.unshift(createdEvent);

		// Reset form
		newEvent.title = "";
		newEvent.description = "";
		newEvent.date = "";
		newEvent.location = "";
		showCreateEventDialog.value = false;
	} catch (error) {
		console.error("Error creating event:", error);
	}
};

// Check if the current user can edit an event
const canEditEvent = (event: Event) => {
	return appStore.userEmail && appStore.userEmail === event.creator_email;
};

// Start editing an event
const startEditingEvent = (event: Event) => {
	if (!canEditEvent(event)) return;

	editingEventId.value = event.id as number;
	editingEvent.id = event.id as number;
	editingEvent.title = event.title;
	editingEvent.description = event.description;
	editingEvent.date = event.date;
	editingEvent.location = event.location;
	editingEvent.creator_email = event.creator_email;
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
			},
			appStore.userEmail,
		);

		// Update the event in the local array
		const index = events.value.findIndex((e) => e.id === updatedEvent.id);
		if (index !== -1) {
			events.value[index] = updatedEvent;
		}

		// Reset editing state
		editingEventId.value = null;
	} catch (error) {
		console.error("Error updating event:", error);
	}
};

// Confirm delete event dialog
const confirmDeleteEvent = (event: Event) => {
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

		// Close the dialog
		showDeleteDialog.value = false;
		eventToDelete.value = null;
	} catch (error) {
		console.error("Error deleting event:", error);
	}
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
</style>
