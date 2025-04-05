<template>
  <v-app>
    <v-main>
      <v-container>
        <v-row justify="center" align="center" style="min-height: 80vh;">
          <v-col cols="12" sm="8" md="6">
            <h1 class="text-center mb-6">Welcome to {{ appStore.appName }}</h1>
            <AuthCard v-if="!appStore.isLoggedIn" />
            <EventList v-else-if="currentView === 'events'" />
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Profile Drawer -->
    <ProfileDrawer
      v-model="showProfileDrawer"
      v-if="appStore.isLoggedIn"
    />

    <!-- Bottom Navigation -->
    <v-bottom-navigation
      v-if="appStore.isLoggedIn"
      :value="currentView"
      grow
    >
      <v-btn
        value="events"
        @click="navigateTo('events')"
      >
        <v-icon>mdi-calendar</v-icon>
        Events
      </v-btn>
      <v-btn
        value="profile"
        @click="showProfileDrawer = true"
      >
        <v-icon>mdi-account</v-icon>
        Profile
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useAppStore } from "@/stores/app";
import ProfileDrawer from "@/components/ProfileDrawer.vue";
import AuthCard from "@/components/AuthCard.vue";
import EventList from "@/components/EventList.vue";

const appStore = useAppStore();
const showProfileDrawer = ref(false);
const currentView = ref("events");

const navigateTo = (view: string) => {
	currentView.value = view;
	if (view === "profile") {
		showProfileDrawer.value = true;
	} else {
		showProfileDrawer.value = false;
	}
};
</script>
