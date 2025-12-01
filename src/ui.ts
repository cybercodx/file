export const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Store Analytics</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>.glass { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); }</style>
</head>
<body class="bg-gradient-to-br from-slate-100 to-slate-200 min-h-screen text-slate-800 font-sans">

    <div id="loginModal" class="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4">
        <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all scale-100">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    <i class="fas fa-lock"></i>
                </div>
                <h2 class="text-2xl font-bold text-slate-800">Admin Access</h2>
                <p class="text-slate-500">Enter your secret key to continue</p>
            </div>
            <input type="password" id="adminSecret" placeholder="Secret Key" 
                   class="w-full p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4 transition-all">
            <button onclick="loadDashboard()" 
                    class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/30">
                Unlock Dashboard
            </button>
        </div>
    </div>

    <div id="dashboard" class="hidden p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <header class="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div class="flex items-center gap-4 mb-4 md:mb-0">
                <div class="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-xl shadow-lg">
                    <i class="fas fa-robot"></i>
                </div>
                <div>
                    <h1 class="text-xl font-bold text-slate-800">File Store Bot</h1>
                    <p class="text-xs text-green-500 font-medium flex items-center gap-1">
                        <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> System Operational
                    </p>
                </div>
            </div>
            <button onclick="loadDashboard()" class="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                <i class="fas fa-sync-alt"></i> Refresh Data
            </button>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500 flex justify-between items-center">
                <div>
                    <p class="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Files Stored</p>
                    <h3 class="text-4xl font-extrabold text-slate-800 mt-1" id="totalFiles">0</h3>
                </div>
                <div class="text-blue-100 text-5xl"><i class="fas fa-database"></i></div>
            </div>
            <div class="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-purple-500 flex justify-between items-center">
                <div>
                    <p class="text-slate-400 text-xs font-bold uppercase tracking-wider">Total File Views</p>
                    <h3 class="text-4xl font-extrabold text-slate-800 mt-1" id="totalViews">0</h3>
                </div>
                <div class="text-purple-100 text-5xl"><i class="fas fa-eye"></i></div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
                <div class="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 class="font-bold text-slate-700">Recent Uploads</h3>
                    <span class="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Last 10</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th class="px-6 py-4">Type</th>
                                <th class="px-6 py-4">Code</th>
                                <th class="px-6 py-4 text-right">Views</th>
                                <th class="px-6 py-4 text-right">Time</th>
                            </tr>
                        </thead>
                        <tbody id="recentFilesTable" class="divide-y divide-slate-100 text-sm"></tbody>
                    </table>
                </div>
            </div>

            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                <h3 class="font-bold text-slate-700 mb-6">Content Distribution</h3>
                <div class="flex-grow flex items-center justify-center relative h-64">
                    <canvas id="trafficChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <script>
        let chartInstance = null;

        async function loadDashboard() {
            const secret = document.getElementById('adminSecret').value;
            if(!secret) return alert("Please enter the secret");

            try {
                const res = await fetch(\`/api/stats?secret=\${secret}\`);
                if (!res.ok) throw new Error("Unauthorized");
                
                const data = await res.json();
                
                document.getElementById('loginModal').classList.add('hidden');
                document.getElementById('dashboard').classList.remove('hidden');
                
                // Animate Numbers
                animateValue("totalFiles", 0, data.totalFiles, 1000);
                animateValue("totalViews", 0, data.totalViews, 1000);

                // Populate Table
                const tbody = document.getElementById('recentFilesTable');
                tbody.innerHTML = '';
                data.recentFiles.forEach(file => {
                    const date = new Date(file.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    let iconClass = 'text-slate-400 fa-file';
                    let bgClass = 'bg-slate-100';
                    
                    if(file.file_type === 'photo') { iconClass = 'text-blue-500 fa-image'; bgClass = 'bg-blue-50'; }
                    if(file.file_type === 'video') { iconClass = 'text-pink-500 fa-video'; bgClass = 'bg-pink-50'; }
                    if(file.file_type === 'audio') { iconClass = 'text-amber-500 fa-music'; bgClass = 'bg-amber-50'; }

                    const row = \`
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="px-6 py-4">
                                <span class="px-3 py-1 rounded-full text-xs font-bold \${bgClass} flex items-center w-fit gap-2">
                                    <i class="fas \${iconClass}"></i> \${file.file_type.toUpperCase()}
                                </span>
                            </td>
                            <td class="px-6 py-4 font-mono text-indigo-600 select-all">\${file.code}</td>
                            <td class="px-6 py-4 text-right font-bold text-slate-700">\${file.views}</td>
                            <td class="px-6 py-4 text-right text-slate-400">\${date}</td>
                        </tr>\`;
                    tbody.innerHTML += row;
                });

                updateChart(data.recentFiles);

            } catch (e) {
                alert("Access Denied: " + e.message);
            }
        }

        function updateChart(files) {
            const ctx = document.getElementById('trafficChart').getContext('2d');
            const counts = { photo: 0, video: 0, document: 0, audio: 0 };
            files.forEach(f => { if(counts[f.file_type] !== undefined) counts[f.file_type]++; });

            if(chartInstance) chartInstance.destroy();

            chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Photos', 'Videos', 'Docs', 'Audio'],
                    datasets: [{
                        data: [counts.photo, counts.video, counts.document, counts.audio],
                        backgroundColor: ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'],
                        borderWidth: 0,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } } },
                    cutout: '75%'
                }
            });
        }

        function animateValue(id, start, end, duration) {
            const obj = document.getElementById(id);
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                obj.innerHTML = Math.floor(progress * (end - start) + start);
                if (progress < 1) window.requestAnimationFrame(step);
            };
            window.requestAnimationFrame(step);
        }
    </script>
</body>
</html>
`;
