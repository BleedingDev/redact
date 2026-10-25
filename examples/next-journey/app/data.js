export const statuses = ['Todo', 'In progress', 'In review', 'Done']
export const tasks = [
  { id: 'FW-104', title: 'Polish the mobile checkout', category: 'Product', status: 'In progress', priority: 'High', owner: 'Maya Chen', initials: 'MC', color: 'peach', description: 'Make the last step feel as simple as the first. Tighten the checkout layout on small screens and keep the order summary in reach.', checklist: ['Keep the total visible above the payment button', 'Use a single column below 640px', 'Check keyboard focus through the form'] },
  { id: 'FW-103', title: 'Finish the launch announcement', category: 'Content', status: 'In review', priority: 'Medium', owner: 'Alex Morgan', initials: 'AM', color: 'lavender' },
  { id: 'FW-102', title: 'Add order confirmation emails', category: 'Engineering', status: 'Todo', priority: 'High', owner: 'Sam Rivera', initials: 'SR', color: 'sage' },
  { id: 'FW-101', title: 'Review product photography', category: 'Design', status: 'Done', priority: 'Medium', owner: 'Maya Chen', initials: 'MC', color: 'peach' },
  { id: 'FW-100', title: 'Connect the analytics events', category: 'Engineering', status: 'Done', priority: 'Low', owner: 'Sam Rivera', initials: 'SR', color: 'sage' },
]

export const initialComments = [
  { id: 'seed-1', author: 'Maya Chen', initials: 'MC', color: 'peach', text: 'The new layout is ready. Could you give it one more pass on mobile?', time: '10:24 AM' },
  { id: 'seed-2', author: 'Alex Morgan', initials: 'AM', color: 'lavender', text: 'On it. I’ll check the keyboard flow too.', time: '10:31 AM' },
]

export const statusClass = status => status.toLowerCase().replaceAll(' ', '-')
