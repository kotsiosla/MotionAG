# 🧭 Navigation Guide - MotionBus_AI

## 📁 Project Structure

### 🎯 Entry Points
- **`src/main.tsx`** - Application entry point
- **`src/App.tsx`** - Main app component with routing
- **`index.html`** - HTML template

### 📄 Pages
- **`src/pages/Index.tsx`** - Main homepage/landing page
- **`src/pages/Install.tsx`** - PWA installation page
- **`src/pages/NotFound.tsx`** - 404 error page

### 🧩 Components

#### Core Components
- **`Header.tsx`** - Main navigation header
- **`NavLink.tsx`** - Navigation link component
- **`ErrorBanner.tsx`** - Error display component

#### Bus/Transit Features
- **`RouteSelector.tsx`** - Select bus routes
- **`RoutePlannerPanel.tsx`** - Plan routes
- **`RouteStopsPanel.tsx`** - View stops on a route
- **`StopsView.tsx`** - View all stops
- **`StopDetailPanel.tsx`** - Detailed stop information
- **`NearestStopPanel.tsx`** - Find nearest stops
- **`NearbyStopsPanel.tsx`** - Nearby stops list
- **`SchedulePanel.tsx`** - View schedules
- **`ScheduleView.tsx`** - Schedule display
- **`VehicleMap.tsx`** - Map showing vehicles
- **`VehicleFollowPanel.tsx`** - Follow specific vehicles

#### Trip Planning
- **`TripPlanner.tsx`** - Plan trips
- **`TripPlanResults.tsx`** - Display trip results
- **`SmartTripPlanner.tsx`** - AI/smart trip planning
- **`SmartTripResults.tsx`** - Smart trip results
- **`SavedTripsPanel.tsx`** - Manage saved trips
- **`TripsTable.tsx`** - Display trips in table

#### Notifications & Alerts
- **`NotificationButton.tsx`** - Notification controls
- **`StopNotificationModal.tsx`** - Configure stop notifications
- **`AlertsList.tsx`** - Display alerts
- **`PWAInstallBanner.tsx`** - PWA installation prompt

#### UI Components
- **`OperatorSelector.tsx`** - Select transit operator
- **`DraggablePanel.tsx`** - Draggable UI panel
- **`ResizableDraggablePanel.tsx`** - Resizable & draggable panel
- **`PullToRefresh.tsx`** - Pull-to-refresh functionality
- **`ApiStatusIndicator.tsx`** - API status display
- **`DataSourceHealthIndicator.tsx`** - Data source health

#### UI Library (`src/components/ui/`)
All shadcn-ui components:
- Buttons, inputs, dialogs, cards, tabs, etc.
- Full component library for building UI

### 🪝 Hooks (`src/hooks/`)

#### Data Hooks
- **`useGtfsData.ts`** - GTFS transit data
- **`useGeocode.ts`** - Geocoding functionality
- **`useNearbyArrivals.ts`** - Get nearby bus arrivals
- **`useTripPlan.ts`** - Trip planning logic
- **`useSmartTripPlan.ts`** - Smart/AI trip planning

#### Notification Hooks
- **`useStopNotifications.ts`** - Stop notifications
- **`useStopArrivalNotifications.ts`** - Arrival notifications
- **`useDelayNotifications.ts`** - Delay notifications
- **`useNativeNotifications.ts`** - Native notifications
- **`usePushSubscription.ts`** - Push notification subscriptions

#### Feature Hooks
- **`useFavoriteRoutes.ts`** - Favorite routes management
- **`useFavoriteStops.ts`** - Favorite stops management
- **`useSavedTrips.ts`** - Saved trips management
- **`useVoiceSearch.ts`** - Voice search functionality
- **`use-mobile.tsx`** - Mobile device detection
- **`use-toast.ts`** - Toast notifications

### 🗄️ Data & Types
- **`src/data/cyprusPOI.ts`** - Cyprus points of interest
- **`src/types/gtfs.ts`** - GTFS data types

### 🔧 Utilities
- **`src/lib/utils.ts`** - Utility functions
- **`src/integrations/supabase/`** - Supabase integration
  - `client.ts` - Supabase client
  - `types.ts` - TypeScript types

### ⚙️ Configuration Files
- **`package.json`** - Dependencies and scripts
- **`vite.config.ts`** - Vite build configuration
- **`tsconfig.json`** - TypeScript configuration
- **`tailwind.config.ts`** - Tailwind CSS configuration
- **`components.json`** - shadcn-ui configuration
- **`capacitor.config.ts`** - Capacitor (mobile) config

### 🗄️ Backend (Supabase)
- **`supabase/functions/`** - Edge functions
  - `gtfs-proxy` - GTFS data proxy
  - `check-delays` - Check for delays
  - `check-stop-arrivals` - Check stop arrivals
  - `check-trip-reminders` - Trip reminders
  - `send-push-notification` - Send notifications
- **`supabase/migrations/`** - Database migrations

## 🚀 Quick Navigation Tips

### To modify the homepage:
→ `src/pages/Index.tsx`

### To change routing:
→ `src/App.tsx`

### To add a new component:
→ `src/components/YourComponent.tsx`

### To add a new page:
1. Create `src/pages/YourPage.tsx`
2. Add route in `src/App.tsx`

### To modify styles:
→ `src/index.css` (global styles)
→ Component files (Tailwind classes)

### To add a new hook:
→ `src/hooks/useYourHook.ts`

### To modify API/data fetching:
→ `src/hooks/useGtfsData.ts` or relevant hook

## 🎨 Tech Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **UI Components:** shadcn-ui (Radix UI)
- **Routing:** React Router
- **State Management:** TanStack Query (React Query)
- **Maps:** Leaflet + React Leaflet
- **Backend:** Supabase
- **Mobile:** Capacitor (Android/iOS)
- **PWA:** Vite PWA Plugin

## 📍 Key Features

1. **Bus Route Planning** - Find and plan bus routes
2. **Real-time Arrivals** - See when buses arrive
3. **Stop Management** - Find stops, save favorites
4. **Trip Planning** - Plan multi-stop trips
5. **Smart Planning** - AI-powered trip suggestions
6. **Notifications** - Get alerts for stops and delays
7. **Offline Support** - PWA with offline capabilities
8. **Mobile App** - Capacitor for native apps

## 🔗 External Resources

- **GitHub:** https://github.com/kotsiosla/MotionBus_AI
- **GTFS Data:** Transit data format
- **Supabase:** Backend/database
- **Leaflet:** Map library

---

**Happy Navigating! 🚌🗺️**


