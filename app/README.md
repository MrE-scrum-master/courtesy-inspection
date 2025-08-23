# Courtesy Inspection - Mobile App

A React Native app built with Expo for digital vehicle inspections.

## Architecture

### Pure Presentation Layer
This app follows a strict **presentation-only architecture**:
- **NO business logic** in the frontend
- **NO calculations or validations** 
- **NO data transformations**
- Just displays what the API returns
- All decisions made by the backend
- Frontend is purely for presentation

### Tech Stack
- **Expo SDK 52** - React Native development platform
- **TypeScript** - Type safety with strict mode enabled
- **React Navigation v6** - Navigation (tabs for mobile, drawer for iPad)
- **React Query** - Server state management and caching
- **Axios** - HTTP client with auto-retry and token refresh
- **Expo SecureStore** - Secure token storage
- **Expo Camera/AV** - Photo capture and voice recording

### Project Structure
```
app/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── FormInput.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── VoiceRecorder.tsx
│   │   └── PhotoCapture.tsx
│   ├── screens/             # Screen components
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── InspectionDetailScreen.tsx
│   │   ├── CreateInspectionScreen.tsx
│   │   ├── CustomerScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── hooks/               # Data fetching hooks
│   │   ├── useAuth.ts
│   │   ├── useInspections.ts
│   │   └── useCustomers.ts
│   ├── services/            # API service layer
│   │   ├── ApiClient.ts     # HTTP client with interceptors
│   │   ├── AuthApi.ts       # Auth endpoints
│   │   ├── InspectionApi.ts # Inspection endpoints
│   │   └── CustomerApi.ts   # Customer endpoints
│   ├── navigation/          # App navigation
│   │   └── AppNavigator.tsx
│   ├── utils/               # Utility functions
│   │   ├── AuthContext.tsx
│   │   └── QueryProvider.tsx
│   ├── types/               # TypeScript definitions
│   │   └── common.ts
│   └── constants/           # App constants
│       ├── api.ts          # API endpoints
│       ├── theme.ts        # Colors, typography, spacing
│       └── index.ts
├── App.tsx                  # Root component
├── app.json                 # Expo configuration
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── babel.config.js          # Babel config with path mapping
└── metro.config.js          # Metro bundler config
```

## Features

### Authentication
- JWT-based authentication with auto-refresh
- Secure token storage using Expo SecureStore
- Role-based access (mechanic, manager, admin)
- Automatic logout on token expiration

### Navigation
- **Mobile**: Bottom tab navigation
- **iPad**: Drawer navigation with split-view support
- **Responsive**: Automatically switches based on screen size
- **Deep linking**: Support for URL-based navigation

### Inspection Management
- Dashboard with recent inspections
- Create new inspections with templates
- Photo capture for inspection items
- Voice note recording
- Real-time status updates
- Send reports to customers via SMS/email

### Customer Management
- Customer search and selection
- Vehicle management
- Inspection history tracking
- Contact information management

### UI/UX Features
- **Material Design** principles
- **Accessibility** compliant (WCAG 2.1 AA)
- **Dark mode** ready
- **Responsive** layouts for all screen sizes
- **Touch-friendly** with larger targets for iPad
- **Loading states** and error handling
- **Offline-ready** with React Query caching

## Getting Started

### Prerequisites
- Node.js 24.0.0 or higher
- Expo CLI installed globally
- iOS Simulator / Android Emulator / Physical device

### Installation
```bash
# Install dependencies
npm install

# Start the development server
npm start

# Run on specific platform
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Web browser
```

### Configuration
The app is configured to connect to the backend API at `http://localhost:3000/api`. This can be changed in `src/constants/api.ts`.

### Development
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build:ios     # iOS
npm run build:android # Android
```

## API Integration

### Error Handling
- **Network errors**: Automatic retry with exponential backoff
- **Authentication errors**: Automatic token refresh
- **Server errors**: User-friendly error messages
- **Validation errors**: Field-level error display

### Caching Strategy
- **Authentication**: Persistent across app restarts
- **Inspections**: 5-minute cache with background refresh
- **Customers**: 5-minute cache with search optimization
- **Templates**: 30-minute cache (rarely change)

### File Uploads
- **Photos**: Max 5MB, auto-resize to 2048x2048
- **Voice**: Max 10MB, 5-minute duration limit
- **Progress tracking**: Real-time upload progress
- **Error recovery**: Automatic retry on failure

## Testing Strategy

### Unit Tests
- Component rendering and props
- Hook behavior and state management
- Utility function correctness
- API service error handling

### Integration Tests
- Authentication flows
- Data fetching and caching
- Navigation between screens
- Form validation and submission

### E2E Tests (Future)
- Complete user workflows
- Cross-platform compatibility
- Performance testing
- Accessibility validation

## Deployment

### Development
```bash
npm start
```

### Staging
```bash
npm run build:staging
```

### Production
```bash
npm run build:production
```

### Distribution
- **iOS**: App Store via EAS Build
- **Android**: Google Play Store via EAS Build
- **Enterprise**: Over-the-air updates via EAS Update

## Performance Optimizations

### Bundle Size
- **Tree shaking** enabled
- **Code splitting** for lazy loading
- **Asset optimization** for images
- **Font subset** for faster loading

### Runtime Performance
- **Memoization** of expensive components
- **Virtualization** for long lists
- **Image caching** and optimization
- **Background sync** for data updates

### Memory Management
- **Automatic cleanup** of subscriptions
- **Image memory** optimization
- **Query cache** size limits
- **Component unmounting** cleanup

## Architecture Decisions

### Why Pure Presentation Layer?
1. **Simplicity**: Frontend only handles display logic
2. **Reliability**: All business rules enforced by backend
3. **Consistency**: Single source of truth for business logic
4. **Security**: Sensitive logic not exposed to client
5. **Maintainability**: Changes only require backend updates

### Why React Query?
1. **Caching**: Intelligent server state management
2. **Background updates**: Keep data fresh automatically
3. **Optimistic updates**: Better user experience
4. **Error handling**: Built-in retry and error boundaries
5. **Developer experience**: Excellent debugging tools

### Why Expo?
1. **Development speed**: Faster iteration cycles
2. **Over-the-air updates**: Push updates without app store
3. **Native modules**: Easy access to device features
4. **Build service**: Simplified deployment process
5. **Testing**: Easy testing on real devices

## Contributing

### Code Style
- **TypeScript strict mode** enforced
- **ESLint** configuration for consistency
- **Prettier** for code formatting
- **Conventional commits** for git messages

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation as needed
4. Submit PR with detailed description
5. Address review feedback
6. Squash and merge when approved

## Troubleshooting

### Common Issues

**Metro bundler errors**:
```bash
expo start -c  # Clear cache
```

**iOS build issues**:
```bash
cd ios && pod install  # Reinstall pods
```

**Android build issues**:
```bash
cd android && ./gradlew clean  # Clean build
```

**Type errors**:
```bash
npm run type-check  # Check TypeScript errors
```

### Performance Issues
- Check React Query dev tools for cache issues
- Use Flipper for debugging network requests
- Monitor bundle size with `npx react-native bundle-analyzer`
- Profile with React DevTools for component renders

### Debug Mode
Enable debug logging by setting `__DEV__` flag:
```typescript
if (__DEV__) {
  console.log('Debug info:', data);
}
```

## License

Private - Courtesy Inspection MVP