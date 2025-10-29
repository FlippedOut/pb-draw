# Pickleball Tournament Draw - AI Development Guide

## Project Overview
This is a React-based tournament management system for pickleball competitions, focusing on automated draw generation and partner pairing. The application follows a three-step workflow: player data input, partner pairing, and tournament draw generation.

## Architecture & Data Flow
- **Core Components** (`src/components/`):
  - `DataInput.jsx` - Player registration and initial data collection
  - `PartnerPairing.jsx` - Partner assignment interface
  - `DrawDisplay.jsx` - Tournament bracket visualization

- **Business Logic** (`src/utils/`):
  - `matchingAlgorithm.js` - Core tournament logic using `TournamentMatcher` class

## Key Development Patterns

### State Management
- Application state is managed via React's `useState` at the root level (`App.jsx`)
- Key state objects:
  ```javascript
  const [players, setPlayers] = useState([]);
  const [preConfirmedPairs, setPreConfirmedPairs] = useState([]);
  const [drawData, setDrawData] = useState(null);
  ```

### Tournament Matching Algorithm
The `TournamentMatcher` class (`matchingAlgorithm.js`) implements sophisticated pairing logic:
- Handles locked partnerships
- Maintains fairness in bye rotations
- Balances skill levels and gender preferences
- Tracks player statistics and previous matchups

### UI/UX Conventions
- Tailwind CSS for styling
- Consistent component structure:
  - Header with navigation
  - Progress steps indicator
  - Main content area
  - Footer with attribution

## Development Workflow

### Local Development
```bash
npm run dev -- --host  # Starts development server with host access
```

### Build & Deploy
```bash
npm run build  # Creates production build
npm run preview  # Preview production build
```

## Common Patterns to Follow
1. **Component Updates**: When modifying UI components, ensure state updates flow through the parent `App.jsx`
2. **Algorithm Modifications**: Changes to matching logic should consider:
   - Locked partnerships (`lockedPartner` property)
   - Player statistics tracking (`playerStats` Map)
   - Bye rotation fairness
3. **Error Handling**: Components should gracefully handle edge cases like:
   - Odd number of players
   - Mismatched skill levels
   - Invalid partner pairings

## Cross-Component Communication
- State changes follow a top-down flow through props
- Event handlers (e.g., `handleDataSubmit`, `handlePairingComplete`) manage state transitions
- The `TournamentMatcher` instance maintains the algorithmic state

## Integration Points
- **React Beautiful DnD**: Used for drag-and-drop partner pairing
- **Lucide React**: Icon system
- **Relume UI/Tailwind**: Styling framework