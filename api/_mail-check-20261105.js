import inquiry from './inquiries.js';
// Temporary internal integration check. Remove immediately after one run.
const SECRET = 'hVustd7e-OVjNGHNa0gt-h-SsRDdXwdW5haIGEhk97U';
export default async function handler(req,res){
  if(req.method!=='GET'||req.query?.k!==SECRET){
    res.setHeader('Cache-Control','no-store');
    return res.status(404).send('Not found');
  }
  return inquiry({
    method:'POST',
    headers:{host:'momentum-orcin-delta.vercel.app',origin:'https://momentum-orcin-delta.vercel.app'},
    body:{
      shop:'MOMENTUM_EMAIL_TEST_20261105',
      name:'SYSTEM_TEST_NOT_A_CUSTOMER',
      phone:'01000000000',
      businessStage:'오픈 준비 중',
      marketingGoal:'폼 메일 수신 초기 인증 검사',
      productTitle:'TEST_ONLY',
      region:'부산',
      budget:'0',
      contact:'전화',
      website:'',
      message:'이 문의는 시스템 확인용 가상 데이터입니다. 실제 고객이 아닙니다.',
      agree:true,
    },
  },res);
}