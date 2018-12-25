/**
 * Project Metrics
 */
const analysis_data_endpoint_url = COVERAGE_INFO_SERVICE_URL;

window.onhashchange = function () {
    location.reload();
};

window.onload = async function(){
    const projectIdDom = document.getElementById("projectId");
    let projectId = projectIdDom.innerText = location.hash.substring(1,location.hash.length);
    // project-info
    let resp = await getAnalysisInfo({projectId, analysisType:'project-metrics', evalMode: false});
    let metrics = resp.project_metrics; 

    let projectMetrics = {
        _id: projectId,
        num_blocks: metrics.num_blocks,
        num_procedures: metrics.num_procedures,
        num_scriptables: metrics.num_scriptables,
        num_scripts: metrics.num_scripts,
        num_vars: metrics.num_vars
    }

    let resultDiv = document.getElementById("result");
    resultDiv.innerText = JSON.stringify(projectMetrics,null, 2);

    console.log('save project info to db');
    await fetch('http://localhost:3000/analysis-infos/metrics', {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(projectMetrics),
    }).then(res => {
        updateStatus(projectId, 'METRICS', 'COMPLETE');
        res.json();
    });
};

