const USE_REMOTE = false;

const BASE_EXTERNAL_SERVER_URL = "http://172.30.18.147";
const REMOTE_REFACTORING_URL = BASE_EXTERNAL_SERVER_URL+":8080/discover";
const LOCAL_REFACTORING_URL = "http://localhost:8080/discover";

const REFACTORING_SERVICE_URL = USE_REMOTE? REMOTE_REFACTORING_URL : LOCAL_REFACTORING_URL;

const BASE_PROJECT_SERVER_URL = "http://localhost:3000";
const PROJECT_DATA_SERVICE_URL = BASE_PROJECT_SERVER_URL + "/data";
const PROJECT_SERVICE_URL = BASE_PROJECT_SERVER_URL + "/projects";
const ANALYSIS_INFO_SERVICE_URL = BASE_PROJECT_SERVER_URL + "/analysis-infos";

//metrics
const METRICS_INFO_SERVICE_URL = ANALYSIS_INFO_SERVICE_URL + "/metrics";

//coverage
const COVERAGE_INFO_SERVICE_URL = ANALYSIS_INFO_SERVICE_URL + "/coverage";
const COVERAGE_ANALYSIS_SERVICE_URL = 'http://localhost:8080/analysis/coverage';

//dupexpr
const DUPEXPR_INFO_SERVICE_URL = ANALYSIS_INFO_SERVICE_URL + "/dupexpr";

const ASSET_SERVER = 'https://cdn.assets.scratch.mit.edu/';
const PROJECT_SERVER = 'https://cdn.projects.scratch.mit.edu/';

const LOCAL_ASSET_SERVER = 'http://localhost:3000/';
const LOCAL_PROJECT_SERVER = 'http://localhost:3000/';

const Scratch = window.Scratch = window.Scratch || {};
const Project = window.Project = window.Project || {};