# Lab Companion Design Guidelines

## Design Approach

**Selected Approach**: Design System - Material Design Dark Theme with customization for technical/monitoring interfaces
**Justification**: Home lab dashboards prioritize information density, readability of technical data, and efficient navigation. Material Design's dark theme patterns provide excellent contrast for extended viewing sessions while maintaining visual hierarchy for complex data.

**Key Principles**:
- Information-first hierarchy with clear data presentation
- Dark theme optimized for prolonged monitoring
- Scannable layouts with distinct card-based sections
- Professional, technical aesthetic suitable for system administration

## Core Design Elements

### Typography
- **Primary Font**: Inter (via Google Fonts CDN)
- **Monospace Font**: JetBrains Mono (for code, IPs, system stats)

**Hierarchy**:
- Page Headers: text-2xl, font-semibold
- Section Headers: text-lg, font-medium
- Card Titles: text-base, font-medium
- Body Text: text-sm, font-normal
- Metric Labels: text-xs, font-medium, uppercase tracking
- Data Values: text-lg to text-3xl, font-mono, font-semibold

### Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12
- Component padding: p-4 to p-6
- Card gaps: gap-4 to gap-6
- Section margins: mb-6 to mb-8
- Content margins: m-2 to m-4

**Grid Structure**:
- Dashboard: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Metrics: grid-cols-2 md:grid-cols-4
- Full-width sections where data requires horizontal space
- max-w-7xl container for overall page content

### Component Library

**Navigation**:
- Fixed top navigation bar with app title and key status indicators
- Sidebar navigation (collapsible on mobile) with icon + label pattern
- Breadcrumb trail for nested sections
- Icons: Heroicons (via CDN)

**Cards/Panels**:
- Rounded corners (rounded-lg)
- Subtle borders for definition
- Consistent padding (p-6)
- Header with title + optional action button
- Content area optimized for data display

**Data Display Components**:
- Stat Cards: Large metric value with label and trend indicator
- Info Lists: Key-value pairs with monospace values
- Status Badges: Inline labels for states (online/offline/warning)
- Progress Bars: For resource utilization (CPU, RAM, storage)
- Tables: Striped rows for service/container listings

**Forms & Inputs**:
- Full-width inputs with clear labels
- Input groups for related fields
- Submit buttons with loading states
- Toggle switches for enable/disable actions

**Interactive Elements**:
- Primary action buttons with solid background
- Secondary actions with outlined style
- Refresh/reload buttons on individual cards
- Expandable sections for detailed information

**Animations**: Minimal and purposeful
- Subtle fade-in for data updates
- Loading spinners for async operations
- No decorative animations

### Images

**No hero image required** - this is a dashboard application focused on data presentation.

**Icon Usage**:
- System status icons throughout (server, database, network indicators)
- Service-specific icons for different lab components
- Alert/warning icons for status notifications

### Special Considerations

**Dashboard Specific**:
- Real-time data update indicators
- Timestamp displays for last refresh
- Visual status indicators (colored dots/badges)
- Collapsible detail sections to reduce clutter
- Quick action buttons on relevant cards

**Technical Display**:
- IP addresses, ports, and URLs in monospace font
- Color coding for status: success (green), warning (yellow), error (red), info (blue)
- Code blocks for configuration snippets or logs
- Copy-to-clipboard buttons for technical values

**Responsive Behavior**:
- Stack cards vertically on mobile
- Collapse sidebar to icon-only on tablet
- Maintain readability of data at all breakpoints
- Prioritize most critical metrics in mobile view

This design creates a professional, data-focused interface optimized for monitoring and managing home lab infrastructure with excellent readability and efficient information architecture.