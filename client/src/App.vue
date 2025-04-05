<template>
  <v-app>
    <v-app-bar app color="primary" class="px-4" dark>
      <div class="d-flex align-center">
        <img src="@/assets/logo_trans.png" alt="ED3N Logo" height="120" class="mr-2" />
        <span class="text-h5">&nbsp;// social</span>
      </div>

      <v-spacer></v-spacer>

      <div class="d-flex align-center">
        <span class="mr-2">Powered by</span>
        <img src="@/assets/polygon_logo.png" alt="Polygon" height="60" class="mx-1 mt-1" />
        <img src="@/assets/metal_logo.svg" alt="Metal" height="45" class="ml-1 mb-1" />
      </div>
    </v-app-bar>

    <v-main>
      <v-container>
        <v-row justify="center" align="center" style="min-height: 80vh;">
          <v-col cols="12" sm="8" md="6">
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
