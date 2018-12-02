/**
 * COVERAGE ANALYSIS
 */
const analysis_data_endpoint_url = COVERAGE_INFO_SERVICE_URL;

window.onhashchange = function () {
    location.reload();
};

const getEstimatedCoverage = async function (analysisServerUrl, xml){
    const result = await fetch(analysisServerUrl, {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        body: xml
    }).then(resp=>resp.json());
    return result;
};

const getProjectXml = async function(id){
    let xml = await fetch(`${PROJECT_DATA_SERVICE_URL}/${id}/project.xml`).then(resp => resp.text());
    return xml;
};

const setupAndRunProfiler = async function(coverageInfo){
    let profilerRun = Scratch.ProfileRun = new ProfilerRun({ vm: Scratch.vm, warmUpTime:0, maxRecordedTime:5000, projectId: Project.ID, initialReport:{}, coverageInfo:{"numBlocks":coverageInfo.estimated_covarage}});
    await profilerRun.runProfiler();
    console.log('todo: get profiler to return coverage result');
    let result = {
        '_id': coverageInfo._id,
        'analysis_name': 'coverage',
        'info': {
            'green_flag_coverage':  profilerRun.stats.completed,
            'frequency': profilerRun.profiler.blockIdRecords,
            'num_stmt_covered': profilerRun.stats.numBlocksCovered,
            'duration': 0
        }
    }
    return result;
};


const createCoverageTask = function(projectId, callback){
    return async function(){
        let projectXml = await getProjectXml(projectId);
        let estimatedCoverageInfo = await getEstimatedCoverage(`${COVERAGE_ANALYSIS_SERVICE_URL}/${projectId}`, projectXml);
        console.log('todo: run profiler to get analysis info');
        let info = await setupAndRunProfiler(estimatedCoverageInfo);
        await saveAnalysisInfo({info, analysis_data_endpoint_url});
        setTimeout(callback(), 2000);
    }
};

window.onload = function(){
    const projectIdDom = document.getElementById("projectId");
    let projectId = projectIdDom.innerText = location.hash.substring(1,location.hash.length);
    configureProjectResourceUrl({LOCAL_ASSET:true});
    loadProjectAndRunTask({
        projectId,
        wsReadyCallback: createCoverageTask(projectId, function () { updateStatus(projectId, 'COVERAGE', 'COMPLETE') }),
        requiredAnalysisUi:false
    });
};

