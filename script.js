// DOM Elements
const dateDisplay = document.querySelector('.date-display');
const nameInput = document.getElementById('name');
const subjectSelect = document.getElementById('subject-select');
const subjectCustomInput = document.getElementById('subject-custom');
const subjectTimeInput = document.getElementById('subject-time');
const statusSelect = document.getElementById('status');
const addButton = document.getElementById('add-entry');
const attendanceEntriesTable = document.getElementById('attendance-entries');
const searchInput = document.getElementById('search');
const exportButton = document.getElementById('export-btn');

// Color Scheme Elements
const colorSchemeToggle = document.getElementById('color-scheme-toggle');
const colorSchemeMenu = document.getElementById('color-scheme-menu');
const colorOptions = document.querySelectorAll('.color-option');

// Counters
const presentCount = document.getElementById('present-count');
const lateCount = document.getElementById('late-count');
const absentCount = document.getElementById('absent-count');
const excusedCount = document.getElementById('excused-count');

// Initialize attendance data from localStorage or empty array
let attendanceData = JSON.parse(localStorage.getItem('attendanceData')) || [];

// Display current date
function updateDateDisplay() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.textContent = now.toLocaleDateString('en-US', options);
}

// Show toast notification
function showToast(message, type = 'info') {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Remove toast after animation completes
    setTimeout(() => {
        toast.remove();
    }, 3500);
}

// Update statistics
function updateStatistics() {
    const counts = attendanceData.reduce((acc, entry) => {
        acc[entry.status]++;
        return acc;
    }, { present: 0, late: 0, absent: 0, excused: 0 });
    
    presentCount.textContent = counts.present;
    lateCount.textContent = counts.late;
    absentCount.textContent = counts.absent;
    excusedCount.textContent = counts.excused;
}

// Format time 
function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit'
    });
}

// Render attendance entries
function renderAttendanceList(data = attendanceData) {
    attendanceEntriesTable.innerHTML = '';
    
    if (data.length === 0) {
        attendanceEntriesTable.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-user-clock"></i>
                    <p>No attendance records yet</p>
                </td>
            </tr>
        `;
        return;
    }
    
    data.forEach((entry, index) => {
        const row = document.createElement('tr');
        // Add data-status attribute for mobile card styling
        row.setAttribute('data-status', entry.status);
        row.innerHTML = `
            <td>${entry.name}</td>
            <td>${entry.subject || 'Not specified'}</td>
            <td><span class="status ${entry.status}">${entry.status}</span></td>
            <td>${formatTime(entry.time)}</td>
            <td class="actions">
                <button class="edit-btn" data-id="${index}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" data-id="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        attendanceEntriesTable.appendChild(row);
        
        // Add animation effect for new entries
        if (entry.isNew) {
            row.style.animation = 'fadeIn 0.5s ease';
            delete entry.isNew;
        }
    });
    
    // Save updated data to localStorage
    localStorage.setItem('attendanceData', JSON.stringify(attendanceData));
}

// Add new attendance entry
function addAttendanceEntry() {
    const name = nameInput.value.trim();
    
    // Get subject based on whether custom is selected or not
    let subject;
    if (subjectSelect.value === 'custom') {
        subject = subjectCustomInput.value.trim();
        if (!subject) {
            showToast('Please enter a custom subject', 'error');
            subjectCustomInput.focus();
            return;
        }
    } else {
        subject = subjectSelect.value;
        if (!subject) {
            showToast('Please select a subject', 'error');
            subjectSelect.focus();
            return;
        }
    }
    
    const subjectTime = subjectTimeInput.value;
    const status = statusSelect.value;
    
    if (!name) {
        showToast('Please enter a name', 'error');
        nameInput.focus();
        return;
    }
    
    // Create entry timestamp but incorporate the subject time for the day
    const now = new Date();
    const [hours, minutes] = subjectTime.split(':');
    const entryTime = new Date(now);
    entryTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
    
    const newEntry = {
        name,
        subject,
        subjectTime,
        status,
        time: entryTime.toISOString(),
        isNew: true
    };
    
    attendanceData.unshift(newEntry);
    
    // Clear input fields
    nameInput.value = '';
    if (subjectSelect.value === 'custom') {
        subjectCustomInput.value = '';
    }
    nameInput.focus();
    
    // Update UI
    renderAttendanceList();
    updateStatistics();
    showToast(`${name} marked as ${status} for ${subject}`, 'success');
}

// Delete attendance entry
function deleteAttendanceEntry(index) {
    const entry = attendanceData[index];
    attendanceData.splice(index, 1);
    
    renderAttendanceList();
    updateStatistics();
    showToast(`Entry deleted`, 'error');
}

// Edit attendance entry
function editAttendanceEntry(index) {
    const entry = attendanceData[index];
    
    // Prefill the form
    nameInput.value = entry.name;
    
    // Check if the subject is in the dropdown options
    const subjectOptions = Array.from(subjectSelect.options)
        .map(option => option.value)
        .filter(value => value !== 'custom' && value !== '');
    
    if (entry.subject && subjectOptions.includes(entry.subject)) {
        subjectSelect.value = entry.subject;
        toggleCustomSubjectField();
    } else if (entry.subject) {
        // If not in dropdown, set as custom
        subjectSelect.value = 'custom';
        subjectCustomInput.value = entry.subject;
        toggleCustomSubjectField();
    }
    
    if (entry.subjectTime) {
        subjectTimeInput.value = entry.subjectTime;
    } else {
        // Extract time from ISO string if no specific subject time
        const entryDate = new Date(entry.time);
        const hours = entryDate.getHours().toString().padStart(2, '0');
        const minutes = entryDate.getMinutes().toString().padStart(2, '0');
        subjectTimeInput.value = `${hours}:${minutes}`;
    }
    statusSelect.value = entry.status;
    
    // Remove the entry
    attendanceData.splice(index, 1);
    
    // Update UI
    renderAttendanceList();
    updateStatistics();
    
    // Focus on the name input
    nameInput.focus();
}

// Filter attendance entries
function filterAttendanceEntries() {
    const searchTerm = searchInput.value.toLowerCase();
    
    if (!searchTerm) {
        renderAttendanceList();
        return;
    }
    
    const filteredData = attendanceData.filter(entry => 
        entry.name.toLowerCase().includes(searchTerm) ||
        (entry.subject && entry.subject.toLowerCase().includes(searchTerm))
    );
    
    renderAttendanceList(filteredData);
}

// Export attendance data to CSV
function exportToCSV() {
    if (attendanceData.length === 0) {
        showToast('No data to export', 'error');
        return;
    }
    
    const csvHeader = ['Name', 'Subject', 'Subject Time', 'Status', 'Time'].join(',');
    const csvRows = attendanceData.map(entry => {
        const time = new Date(entry.time).toLocaleString();
        return [entry.name, entry.subject || 'Not specified', entry.subjectTime || '', entry.status, time].join(',');
    });
    
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.setAttribute('href', url);
    a.setAttribute('download', `attendance_${new Date().toISOString().split('T')[0]}.csv`);
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showToast('Attendance data exported successfully', 'success');
}

// Toggle custom subject field based on selection
function toggleCustomSubjectField() {
    if (subjectSelect.value === 'custom') {
        subjectCustomInput.classList.remove('hidden');
        subjectCustomInput.focus();
    } else {
        subjectCustomInput.classList.add('hidden');
    }
}

// Event Listeners
addButton.addEventListener('click', addAttendanceEntry);
searchInput.addEventListener('input', filterAttendanceEntries);
exportButton.addEventListener('click', exportToCSV);
subjectSelect.addEventListener('change', toggleCustomSubjectField);

// Event delegation for edit and delete buttons
attendanceEntriesTable.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    
    const index = target.dataset.id;
    
    if (target.classList.contains('delete-btn')) {
        if (confirm('Are you sure you want to delete this entry?')) {
            deleteAttendanceEntry(index);
        }
    } else if (target.classList.contains('edit-btn')) {
        editAttendanceEntry(index);
    }
});

// Handle form submission with Enter key
nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addAttendanceEntry();
    }
});

// Color scheme management
function initializeColorScheme() {
    // Check if a theme is saved in localStorage
    const savedTheme = localStorage.getItem('themePreference');
    if (savedTheme) {
        applyTheme(savedTheme);
        highlightActiveTheme(savedTheme);
    }
    
    // Toggle color scheme menu
    colorSchemeToggle.addEventListener('click', () => {
        colorSchemeMenu.classList.toggle('active');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!colorSchemeToggle.contains(e.target) && !colorSchemeMenu.contains(e.target)) {
            colorSchemeMenu.classList.remove('active');
        }
    });
    
    // Theme selection
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.getAttribute('data-theme');
            applyTheme(theme);
            highlightActiveTheme(theme);
            localStorage.setItem('themePreference', theme);
            colorSchemeMenu.classList.remove('active');
            showToast(`Theme changed to ${theme}`, 'success');
        });
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        const themeColors = {
            'default': '#4361ee',
            'ocean': '#0077b6',
            'sunset': '#e76f51',
            'forest': '#588157',
            'dark': '#1e1e1e',
            'pink': '#ff0080'
        };
        metaThemeColor.setAttribute('content', themeColors[theme] || themeColors['default']);
    }
}

function highlightActiveTheme(activeTheme) {
    colorOptions.forEach(option => {
        const theme = option.getAttribute('data-theme');
        if (theme === activeTheme) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

// Initialize
updateDateDisplay();
renderAttendanceList();
updateStatistics();
initializeColorScheme();

// Update date display every minute
setInterval(updateDateDisplay, 60000);

// Add sample data for demonstration if no data exists
if (attendanceData.length === 0) {
    const now = new Date();
    const sampleData = [
        { name: 'John Doe', subject: 'Mathematics', subjectTime: '08:00', status: 'present', time: now.toISOString() },
        { name: 'Jane Smith', subject: 'Science', subjectTime: '09:30', status: 'late', time: new Date(now - 30 * 60000).toISOString() },
        { name: 'Robert Johnson', subject: 'English', subjectTime: '11:00', status: 'absent', time: new Date(now - 60 * 60000).toISOString() },
        { name: 'Lisa Brown', subject: 'Computer Science', subjectTime: '13:30', status: 'excused', time: new Date(now - 90 * 60000).toISOString() }
    ];
    
    attendanceData = sampleData;
    renderAttendanceList();
    updateStatistics();
}