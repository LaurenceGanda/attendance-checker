// DOM Elements
const dateDisplay = document.querySelector('.date-display');
const nameInput = document.getElementById('name');
const subjectSelect = document.getElementById('subject');
const subjectTimeInput = document.getElementById('subject-time');
const statusSelect = document.getElementById('status');
const addButton = document.getElementById('add-entry');
const attendanceEntriesTable = document.getElementById('attendance-entries');
const searchInput = document.getElementById('search');
const exportButton = document.getElementById('export-btn');

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
                <td colspan="4" class="empty-state">
                    <i class="fas fa-user-clock"></i>
                    <p>No attendance records yet</p>
                </td>
            </tr>
        `;
        return;
    }
    
    data.forEach((entry, index) => {
        const row = document.createElement('tr');
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
    const subject = subjectSelect.value;
    const subjectTime = subjectTimeInput.value;
    const status = statusSelect.value;
    
    if (!name) {
        showToast('Please enter a name', 'error');
        nameInput.focus();
        return;
    }
    
    if (!subject) {
        showToast('Please select a subject', 'error');
        subjectSelect.focus();
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
    
    // Clear input field
    nameInput.value = '';
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
    if (entry.subject) subjectSelect.value = entry.subject;
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

// Event Listeners
addButton.addEventListener('click', addAttendanceEntry);
searchInput.addEventListener('input', filterAttendanceEntries);
exportButton.addEventListener('click', exportToCSV);

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

// Initialize
updateDateDisplay();
renderAttendanceList();
updateStatistics();

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
