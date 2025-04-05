<template>
  <div class="event-list">
    <v-container>
      <h2 class="text-h4 mb-4">Upcoming Events</h2>

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
          <v-card class="mx-auto">
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
              <v-btn
                variant="text"
                color="primary"
                :to="'/event/' + event.id"
              >
                View Details
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

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
              :rules="[v => !!v || 'Title is required']"
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
              :rules="[v => !!v || 'Date is required']"
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
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, reactive } from "vue";
import { useAppStore } from "@/stores/app";
import type { Event } from "../../../server/server";
import { fetchEvents, createEvent as createEventAPI } from "@/utils/api";

const appStore = useAppStore();
const events = ref<Event[]>([]);
const loading = ref(true);
const showCreateEventDialog = ref(false);
const valid = ref(false);

const newEvent = reactive({
	title: "",
	description: "",
	date: "",
	location: "",
});

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
</script>

<style scoped>
.float-btn {
  position: fixed;
  bottom: 80px;
  right: 24px;
  z-index: 5;
}
</style>
