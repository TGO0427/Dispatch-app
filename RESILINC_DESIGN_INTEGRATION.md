# Resilinc Design System Integration

This document outlines the Resilinc design system integration into the Dispatch App.

## Design Tokens Applied

### Color Palette
- **Primary Blue**: `#2563EB` (resilinc-primary)
- **Dark Blue**: `#1D4ED8` (resilinc-primary-dark)
- **Alert Red**: `#EF4444` (resilinc-alert)
- **Warning Orange**: `#F97316` (resilinc-warning)
- **Gray Scale**: Standard Tailwind gray palette (50-900)

### Typography
- **Font Family**: System font stack (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, etc.)
- **Heading 1**: 30px (text-3xl), font-bold
- **Heading 2**: 20px (text-xl), font-bold
- **Heading 3**: 18px (text-lg), font-semibold
- **Body Text**: 16px (text-base), font-regular
- **Secondary Text**: 14px (text-sm), font-regular
- **Caption Text**: 12px (text-xs), font-regular

### Spacing & Layout
- **Card Padding**: 16px-24px (p-4 to p-6)
- **Card Border Radius**: 8px (rounded-card)
- **Element Gaps**: 8px-24px (gap-2 to gap-6)
- **Section Spacing**: 32px (space-y-8)

### Shadows
- **Card Shadow**: Subtle elevation (shadow-card)
- **Hover Shadow**: Enhanced elevation on hover (shadow-card-hover)

### Borders
- **Card Borders**: 1px solid gray-200
- **Focus Rings**: 2px resilinc-primary

## Component Updates

### Button Component
- Primary buttons use `resilinc-primary` background
- Hover states use `resilinc-primary-dark`
- Outline buttons have `resilinc-primary` borders and text
- Rounded corners use `rounded-card` (8px)
- Font size standardized to 14px (text-sm)

### Badge Component
- Added new variants:
  - `new`: Blue background (blue-50) with primary text
  - `past-due`: Red background (red-50) with alert text
  - `success`: Green background (green-50) with green text
- All badges use uppercase text with tracking-wide
- Padding increased to px-3 py-1

### Card Component
- Border radius changed to `rounded-card` (8px)
- Subtle shadow with hover effect
- Title text uses xl size and bold weight
- Border color standardized to gray-200

### Input & Select Components
- Border radius changed to `rounded-card`
- Focus ring uses `resilinc-primary`
- Border color: gray-300
- Placeholder text: gray-400

### Statistics Cards
- Simplified layout: large number on top, label below
- Number: 30px (text-3xl), font-bold
- Label: 12px (text-xs), uppercase, tracking-wide
- Color-coded based on metric type:
  - Total: gray-900
  - Pending/Busy: resilinc-warning
  - In Progress: resilinc-primary
  - Completed/Available: green-600
  - Exceptions: resilinc-alert

### Job Cards
- Enhanced visual hierarchy with semibold titles
- Badge variant changes based on status and priority:
  - Urgent pending jobs → "past-due" badge
  - Regular pending jobs → "new" badge
  - Completed jobs → "success" badge
  - Exception jobs → "destructive" badge
- Increased padding to p-4
- Better spacing between elements (gap-3)

### Driver Cards
- Improved layout with better hierarchy
- Name displayed prominently (font-semibold, text-base)
- Callsign as secondary line
- Status badges with color-coded backgrounds
- Enhanced drag-and-drop feedback with resilinc-primary border

### Sidebar Navigation
- **Width**: 64px (w-16)
- **Background**: Dark gray (#111827 / gray-900)
- **Icon Size**: 20px (w-5 h-5)
- **Button Size**: 40px × 40px (w-10 h-10)
- **Active State**: Blue background (resilinc-primary), white icon
- **Inactive State**: Gray icons (#9CA3AF), hover transitions to white with dark gray background
- **Border Radius**: 8px on buttons
- **Spacing**: 16px between icons (space-y-4)
- **Navigation Items**: Home, Jobs (Clipboard), Calendar, Dashboard (Grid), History (Clock), Settings
- **Fixed Position**: Sidebar remains fixed on left side with main content scrolling

## File Changes

### Configuration
- `tailwind.config.js`: Added Resilinc color tokens and custom utilities

### UI Components
- `src/components/ui/Button.tsx`: Updated colors and sizing
- `src/components/ui/Badge.tsx`: Added new variants and updated styles
- `src/components/ui/Card.tsx`: Updated border radius and shadows
- `src/components/ui/Input.tsx`: Updated colors and border radius
- `src/components/ui/Select.tsx`: Updated colors and border radius

### Feature Components
- `src/App.tsx`: Updated layout, statistics cards, sidebar integration, and color scheme
- `src/components/Sidebar.tsx`: NEW - Navigation sidebar component
- `src/components/JobCard.tsx`: Enhanced styling and badge logic
- `src/components/DriverCard.tsx`: Improved visual hierarchy
- `src/components/FilterBar.tsx`: Updated colors
- `src/components/SortBar.tsx`: Updated colors

## Design Principles Maintained

1. **Clean, Spacious Design**: Adequate padding and spacing throughout
2. **Clear Visual Hierarchy**: Font sizes and weights clearly distinguish importance
3. **Subtle Elevations**: Card shadows provide depth without distraction
4. **Color-Coded Information**: Status and priority use consistent color language
5. **Professional Appearance**: Corporate blue palette with clean typography
6. **Consistent Interactions**: Hover states and transitions are smooth and predictable

## Responsive Behavior

All components maintain responsive behavior:
- Cards stack appropriately on mobile
- Grid layouts adapt to screen size
- Touch-friendly tap targets (minimum 40px)
- Text truncation prevents overflow

## Accessibility

- High contrast ratios for all text
- Focus indicators on interactive elements
- Semantic HTML structure maintained
- ARIA labels where appropriate

## Browser Compatibility

The design system uses standard CSS features with Tailwind:
- Modern browsers (Chrome, Firefox, Safari, Edge)
- No vendor-specific features
- Graceful degradation for older browsers

## Future Enhancements

Potential additions to match Resilinc more closely:
- Custom icon library
- Animation timing functions
- Loading states and skeletons
- Empty state illustrations
- Data visualization components
