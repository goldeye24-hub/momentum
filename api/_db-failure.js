'use strict';
// Use only HTTP status and allowlisted upstream error codes. Do not propagate
// URLs, SQL statements, database content, API secrets, or exception messages.
function analyze(error){
 const status=Number(error?.status);
 const httpStatus=Number.isInteger(status)&&status>=400&&status<=599?status:null;
 const code=typeof error?.upstreamCode==='string'&&/^(?:PGRST\d{3}|[0-9A-Z]{5})$/.test(error.upstreamCode)?error.upstreamCode:null;
 let category='network_or_unknown';
 if(error?.code==='not_configured')category='configuration_missing';
 else if(error?.name==='AbortError'||error?.code==='ETIMEDOUT')category='timeout';
 else if(httpStatus===401)category='api_key_rejected';
 else if(httpStatus===403||code==='42501')category='permission_denied';
 else if(code==='PGRST205'||code==='42P01'||httpStatus===404)category='table_or_schema_missing';
 else if(httpStatus===429)category='upstream_rate_limit';
 else if(httpStatus>=500)category='supabase_service_error';
 else if(httpStatus)category='upstream_request_error';
 return {category,...(httpStatus?{httpStatus}:{}),...(code?{upstreamCode:code}:{})};
}
const descriptions={
 configuration_missing:'Supabase 운영 환경변수를 확인해야 합니다.',
 timeout:'Supabase 응답 시간이 초과됐습니다.',
 api_key_rejected:'Supabase Secret API Key가 올바른 프로젝트 키인지 확인해야 합니다.',
 permission_denied:'Supabase 서비스 키의 데이터 접근 권한을 확인해야 합니다.',
 table_or_schema_missing:'Supabase 테이블 또는 API 공개 스키마 설정을 확인해야 합니다.',
 upstream_rate_limit:'Supabase 서버 요청량 제한 상태입니다.',
 supabase_service_error:'Supabase 서버에서 오류가 반환됐습니다.',
 upstream_request_error:'Supabase 데이터 요청이 거절됐습니다.',
 network_or_unknown:'Supabase 네트워크 또는 서버 연결을 확인해야 합니다.'
};
function message(error){
 const result=analyze(error);
 return descriptions[result.category]+(result.httpStatus?' (HTTP '+result.httpStatus+')':'')+
  (result.upstreamCode?' ['+result.upstreamCode+']':'');
}
module.exports={analyze,message};
