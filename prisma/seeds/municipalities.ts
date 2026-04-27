/**
 * 전국 226개 시·군·구 + 17개 광역시·도 시드
 * - 행정안전부 표준 행정코드(5자리, 일부 7자리) 기준
 * - 출처: https://www.code.go.kr (2024 기준)
 * - 광역시·도(17)는 region=자기자신, code=2자리(11~50)
 * - 시·군·구(226)는 region=상위 광역, code=5자리
 *
 * 실행:
 *   DATABASE_URL=... npx tsx prisma/seeds/municipalities.ts
 *
 * 동작:
 *   - 기존 코드와 매칭되면 update (이름·region 동기화)
 *   - 없으면 ACTIVE 상태로 신규 생성
 *   - 4개 데모 지자체(예: 강남구 11680)도 region이 자동 보정됨
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Muni = { code: string; name: string; region: string };

const MUNICIPALITIES: Muni[] = [
  /* 광역시·도 17 — code 2자리 */
  { code: '11', name: '서울특별시',     region: '서울특별시' },
  { code: '26', name: '부산광역시',     region: '부산광역시' },
  { code: '27', name: '대구광역시',     region: '대구광역시' },
  { code: '28', name: '인천광역시',     region: '인천광역시' },
  { code: '29', name: '광주광역시',     region: '광주광역시' },
  { code: '30', name: '대전광역시',     region: '대전광역시' },
  { code: '31', name: '울산광역시',     region: '울산광역시' },
  { code: '36', name: '세종특별자치시', region: '세종특별자치시' },
  { code: '41', name: '경기도',         region: '경기도' },
  { code: '42', name: '강원특별자치도', region: '강원특별자치도' },
  { code: '43', name: '충청북도',       region: '충청북도' },
  { code: '44', name: '충청남도',       region: '충청남도' },
  { code: '45', name: '전북특별자치도', region: '전북특별자치도' },
  { code: '46', name: '전라남도',       region: '전라남도' },
  { code: '47', name: '경상북도',       region: '경상북도' },
  { code: '48', name: '경상남도',       region: '경상남도' },
  { code: '50', name: '제주특별자치도', region: '제주특별자치도' },

  /* 서울특별시 25개 자치구 */
  { code: '11110', name: '종로구',     region: '서울특별시' },
  { code: '11140', name: '중구',       region: '서울특별시' },
  { code: '11170', name: '용산구',     region: '서울특별시' },
  { code: '11200', name: '성동구',     region: '서울특별시' },
  { code: '11215', name: '광진구',     region: '서울특별시' },
  { code: '11230', name: '동대문구',   region: '서울특별시' },
  { code: '11260', name: '중랑구',     region: '서울특별시' },
  { code: '11290', name: '성북구',     region: '서울특별시' },
  { code: '11305', name: '강북구',     region: '서울특별시' },
  { code: '11320', name: '도봉구',     region: '서울특별시' },
  { code: '11350', name: '노원구',     region: '서울특별시' },
  { code: '11380', name: '은평구',     region: '서울특별시' },
  { code: '11410', name: '서대문구',   region: '서울특별시' },
  { code: '11440', name: '마포구',     region: '서울특별시' },
  { code: '11470', name: '양천구',     region: '서울특별시' },
  { code: '11500', name: '강서구',     region: '서울특별시' },
  { code: '11530', name: '구로구',     region: '서울특별시' },
  { code: '11545', name: '금천구',     region: '서울특별시' },
  { code: '11560', name: '영등포구',   region: '서울특별시' },
  { code: '11590', name: '동작구',     region: '서울특별시' },
  { code: '11620', name: '관악구',     region: '서울특별시' },
  { code: '11650', name: '서초구',     region: '서울특별시' },
  { code: '11680', name: '강남구',     region: '서울특별시' },
  { code: '11710', name: '송파구',     region: '서울특별시' },
  { code: '11740', name: '강동구',     region: '서울특별시' },

  /* 부산광역시 16개 (15구 1군) */
  { code: '26110', name: '중구',       region: '부산광역시' },
  { code: '26140', name: '서구',       region: '부산광역시' },
  { code: '26170', name: '동구',       region: '부산광역시' },
  { code: '26200', name: '영도구',     region: '부산광역시' },
  { code: '26230', name: '부산진구',   region: '부산광역시' },
  { code: '26260', name: '동래구',     region: '부산광역시' },
  { code: '26290', name: '남구',       region: '부산광역시' },
  { code: '26320', name: '북구',       region: '부산광역시' },
  { code: '26350', name: '해운대구',   region: '부산광역시' },
  { code: '26380', name: '사하구',     region: '부산광역시' },
  { code: '26410', name: '금정구',     region: '부산광역시' },
  { code: '26440', name: '강서구',     region: '부산광역시' },
  { code: '26470', name: '연제구',     region: '부산광역시' },
  { code: '26500', name: '수영구',     region: '부산광역시' },
  { code: '26530', name: '사상구',     region: '부산광역시' },
  { code: '26710', name: '기장군',     region: '부산광역시' },

  /* 대구광역시 9개 (7구 2군) */
  { code: '27110', name: '중구',       region: '대구광역시' },
  { code: '27140', name: '동구',       region: '대구광역시' },
  { code: '27170', name: '서구',       region: '대구광역시' },
  { code: '27200', name: '남구',       region: '대구광역시' },
  { code: '27230', name: '북구',       region: '대구광역시' },
  { code: '27260', name: '수성구',     region: '대구광역시' },
  { code: '27290', name: '달서구',     region: '대구광역시' },
  { code: '27710', name: '달성군',     region: '대구광역시' },
  { code: '27720', name: '군위군',     region: '대구광역시' },

  /* 인천광역시 10개 (8구 2군) */
  { code: '28110', name: '중구',       region: '인천광역시' },
  { code: '28140', name: '동구',       region: '인천광역시' },
  { code: '28177', name: '미추홀구',   region: '인천광역시' },
  { code: '28185', name: '연수구',     region: '인천광역시' },
  { code: '28200', name: '남동구',     region: '인천광역시' },
  { code: '28237', name: '부평구',     region: '인천광역시' },
  { code: '28245', name: '계양구',     region: '인천광역시' },
  { code: '28260', name: '서구',       region: '인천광역시' },
  { code: '28710', name: '강화군',     region: '인천광역시' },
  { code: '28720', name: '옹진군',     region: '인천광역시' },

  /* 광주광역시 5개 자치구 */
  { code: '29110', name: '동구',       region: '광주광역시' },
  { code: '29140', name: '서구',       region: '광주광역시' },
  { code: '29155', name: '남구',       region: '광주광역시' },
  { code: '29170', name: '북구',       region: '광주광역시' },
  { code: '29200', name: '광산구',     region: '광주광역시' },

  /* 대전광역시 5개 자치구 */
  { code: '30110', name: '동구',       region: '대전광역시' },
  { code: '30140', name: '중구',       region: '대전광역시' },
  { code: '30170', name: '서구',       region: '대전광역시' },
  { code: '30200', name: '유성구',     region: '대전광역시' },
  { code: '30230', name: '대덕구',     region: '대전광역시' },

  /* 울산광역시 5개 (4구 1군) */
  { code: '31110', name: '중구',       region: '울산광역시' },
  { code: '31140', name: '남구',       region: '울산광역시' },
  { code: '31170', name: '동구',       region: '울산광역시' },
  { code: '31200', name: '북구',       region: '울산광역시' },
  { code: '31710', name: '울주군',     region: '울산광역시' },

  /* 세종특별자치시 — 단일 (자치구 없음) */
  { code: '36110', name: '세종시',     region: '세종특별자치시' },

  /* 경기도 31개 (28시 3군) */
  { code: '41111', name: '수원시 장안구', region: '경기도' },
  { code: '41113', name: '수원시 권선구', region: '경기도' },
  { code: '41115', name: '수원시 팔달구', region: '경기도' },
  { code: '41117', name: '수원시 영통구', region: '경기도' },
  { code: '41131', name: '성남시 수정구', region: '경기도' },
  { code: '41133', name: '성남시 중원구', region: '경기도' },
  { code: '41135', name: '성남시 분당구', region: '경기도' },
  { code: '41150', name: '의정부시',   region: '경기도' },
  { code: '41171', name: '안양시 만안구', region: '경기도' },
  { code: '41173', name: '안양시 동안구', region: '경기도' },
  { code: '41190', name: '부천시',     region: '경기도' },
  { code: '41210', name: '광명시',     region: '경기도' },
  { code: '41220', name: '평택시',     region: '경기도' },
  { code: '41250', name: '동두천시',   region: '경기도' },
  { code: '41271', name: '안산시 상록구', region: '경기도' },
  { code: '41273', name: '안산시 단원구', region: '경기도' },
  { code: '41281', name: '고양시 덕양구', region: '경기도' },
  { code: '41285', name: '고양시 일산동구', region: '경기도' },
  { code: '41287', name: '고양시 일산서구', region: '경기도' },
  { code: '41290', name: '과천시',     region: '경기도' },
  { code: '41310', name: '구리시',     region: '경기도' },
  { code: '41360', name: '남양주시',   region: '경기도' },
  { code: '41370', name: '오산시',     region: '경기도' },
  { code: '41390', name: '시흥시',     region: '경기도' },
  { code: '41410', name: '군포시',     region: '경기도' },
  { code: '41430', name: '의왕시',     region: '경기도' },
  { code: '41450', name: '하남시',     region: '경기도' },
  { code: '41461', name: '용인시 처인구', region: '경기도' },
  { code: '41463', name: '용인시 기흥구', region: '경기도' },
  { code: '41465', name: '용인시 수지구', region: '경기도' },
  { code: '41480', name: '파주시',     region: '경기도' },
  { code: '41500', name: '이천시',     region: '경기도' },
  { code: '41550', name: '안성시',     region: '경기도' },
  { code: '41570', name: '김포시',     region: '경기도' },
  { code: '41590', name: '화성시',     region: '경기도' },
  { code: '41610', name: '광주시',     region: '경기도' },
  { code: '41630', name: '양주시',     region: '경기도' },
  { code: '41650', name: '포천시',     region: '경기도' },
  { code: '41670', name: '여주시',     region: '경기도' },
  { code: '41800', name: '연천군',     region: '경기도' },
  { code: '41820', name: '가평군',     region: '경기도' },
  { code: '41830', name: '양평군',     region: '경기도' },

  /* 강원특별자치도 18개 (7시 11군) */
  { code: '42110', name: '춘천시',     region: '강원특별자치도' },
  { code: '42130', name: '원주시',     region: '강원특별자치도' },
  { code: '42150', name: '강릉시',     region: '강원특별자치도' },
  { code: '42170', name: '동해시',     region: '강원특별자치도' },
  { code: '42190', name: '태백시',     region: '강원특별자치도' },
  { code: '42210', name: '속초시',     region: '강원특별자치도' },
  { code: '42230', name: '삼척시',     region: '강원특별자치도' },
  { code: '42720', name: '홍천군',     region: '강원특별자치도' },
  { code: '42730', name: '횡성군',     region: '강원특별자치도' },
  { code: '42750', name: '영월군',     region: '강원특별자치도' },
  { code: '42760', name: '평창군',     region: '강원특별자치도' },
  { code: '42770', name: '정선군',     region: '강원특별자치도' },
  { code: '42780', name: '철원군',     region: '강원특별자치도' },
  { code: '42790', name: '화천군',     region: '강원특별자치도' },
  { code: '42800', name: '양구군',     region: '강원특별자치도' },
  { code: '42810', name: '인제군',     region: '강원특별자치도' },
  { code: '42820', name: '고성군',     region: '강원특별자치도' },
  { code: '42830', name: '양양군',     region: '강원특별자치도' },

  /* 충청북도 11개 (3시 8군) */
  { code: '43111', name: '청주시 상당구', region: '충청북도' },
  { code: '43112', name: '청주시 서원구', region: '충청북도' },
  { code: '43113', name: '청주시 흥덕구', region: '충청북도' },
  { code: '43114', name: '청주시 청원구', region: '충청북도' },
  { code: '43130', name: '충주시',     region: '충청북도' },
  { code: '43150', name: '제천시',     region: '충청북도' },
  { code: '43720', name: '보은군',     region: '충청북도' },
  { code: '43730', name: '옥천군',     region: '충청북도' },
  { code: '43740', name: '영동군',     region: '충청북도' },
  { code: '43745', name: '증평군',     region: '충청북도' },
  { code: '43750', name: '진천군',     region: '충청북도' },
  { code: '43760', name: '괴산군',     region: '충청북도' },
  { code: '43770', name: '음성군',     region: '충청북도' },
  { code: '43800', name: '단양군',     region: '충청북도' },

  /* 충청남도 15개 (8시 7군) */
  { code: '44131', name: '천안시 동남구', region: '충청남도' },
  { code: '44133', name: '천안시 서북구', region: '충청남도' },
  { code: '44150', name: '공주시',     region: '충청남도' },
  { code: '44180', name: '보령시',     region: '충청남도' },
  { code: '44200', name: '아산시',     region: '충청남도' },
  { code: '44210', name: '서산시',     region: '충청남도' },
  { code: '44230', name: '논산시',     region: '충청남도' },
  { code: '44250', name: '계룡시',     region: '충청남도' },
  { code: '44270', name: '당진시',     region: '충청남도' },
  { code: '44710', name: '금산군',     region: '충청남도' },
  { code: '44760', name: '부여군',     region: '충청남도' },
  { code: '44770', name: '서천군',     region: '충청남도' },
  { code: '44790', name: '청양군',     region: '충청남도' },
  { code: '44800', name: '홍성군',     region: '충청남도' },
  { code: '44810', name: '예산군',     region: '충청남도' },
  { code: '44825', name: '태안군',     region: '충청남도' },

  /* 전북특별자치도 14개 (6시 8군) */
  { code: '45111', name: '전주시 완산구', region: '전북특별자치도' },
  { code: '45113', name: '전주시 덕진구', region: '전북특별자치도' },
  { code: '45130', name: '군산시',     region: '전북특별자치도' },
  { code: '45140', name: '익산시',     region: '전북특별자치도' },
  { code: '45180', name: '정읍시',     region: '전북특별자치도' },
  { code: '45190', name: '남원시',     region: '전북특별자치도' },
  { code: '45210', name: '김제시',     region: '전북특별자치도' },
  { code: '45710', name: '완주군',     region: '전북특별자치도' },
  { code: '45720', name: '진안군',     region: '전북특별자치도' },
  { code: '45730', name: '무주군',     region: '전북특별자치도' },
  { code: '45740', name: '장수군',     region: '전북특별자치도' },
  { code: '45750', name: '임실군',     region: '전북특별자치도' },
  { code: '45770', name: '순창군',     region: '전북특별자치도' },
  { code: '45790', name: '고창군',     region: '전북특별자치도' },
  { code: '45800', name: '부안군',     region: '전북특별자치도' },

  /* 전라남도 22개 (5시 17군) */
  { code: '46110', name: '목포시',     region: '전라남도' },
  { code: '46130', name: '여수시',     region: '전라남도' },
  { code: '46150', name: '순천시',     region: '전라남도' },
  { code: '46170', name: '나주시',     region: '전라남도' },
  { code: '46230', name: '광양시',     region: '전라남도' },
  { code: '46710', name: '담양군',     region: '전라남도' },
  { code: '46720', name: '곡성군',     region: '전라남도' },
  { code: '46730', name: '구례군',     region: '전라남도' },
  { code: '46770', name: '고흥군',     region: '전라남도' },
  { code: '46780', name: '보성군',     region: '전라남도' },
  { code: '46790', name: '화순군',     region: '전라남도' },
  { code: '46800', name: '장흥군',     region: '전라남도' },
  { code: '46810', name: '강진군',     region: '전라남도' },
  { code: '46820', name: '해남군',     region: '전라남도' },
  { code: '46830', name: '영암군',     region: '전라남도' },
  { code: '46840', name: '무안군',     region: '전라남도' },
  { code: '46860', name: '함평군',     region: '전라남도' },
  { code: '46870', name: '영광군',     region: '전라남도' },
  { code: '46880', name: '장성군',     region: '전라남도' },
  { code: '46890', name: '완도군',     region: '전라남도' },
  { code: '46900', name: '진도군',     region: '전라남도' },
  { code: '46910', name: '신안군',     region: '전라남도' },

  /* 경상북도 22개 (10시 12군) */
  { code: '47111', name: '포항시 남구', region: '경상북도' },
  { code: '47113', name: '포항시 북구', region: '경상북도' },
  { code: '47130', name: '경주시',     region: '경상북도' },
  { code: '47150', name: '김천시',     region: '경상북도' },
  { code: '47170', name: '안동시',     region: '경상북도' },
  { code: '47190', name: '구미시',     region: '경상북도' },
  { code: '47210', name: '영주시',     region: '경상북도' },
  { code: '47230', name: '영천시',     region: '경상북도' },
  { code: '47250', name: '상주시',     region: '경상북도' },
  { code: '47280', name: '문경시',     region: '경상북도' },
  { code: '47290', name: '경산시',     region: '경상북도' },
  { code: '47730', name: '의성군',     region: '경상북도' },
  { code: '47750', name: '청송군',     region: '경상북도' },
  { code: '47760', name: '영양군',     region: '경상북도' },
  { code: '47770', name: '영덕군',     region: '경상북도' },
  { code: '47820', name: '청도군',     region: '경상북도' },
  { code: '47830', name: '고령군',     region: '경상북도' },
  { code: '47840', name: '성주군',     region: '경상북도' },
  { code: '47850', name: '칠곡군',     region: '경상북도' },
  { code: '47900', name: '예천군',     region: '경상북도' },
  { code: '47920', name: '봉화군',     region: '경상북도' },
  { code: '47930', name: '울진군',     region: '경상북도' },
  { code: '47940', name: '울릉군',     region: '경상북도' },

  /* 경상남도 18개 (8시 10군) */
  { code: '48121', name: '창원시 의창구', region: '경상남도' },
  { code: '48123', name: '창원시 성산구', region: '경상남도' },
  { code: '48125', name: '창원시 마산합포구', region: '경상남도' },
  { code: '48127', name: '창원시 마산회원구', region: '경상남도' },
  { code: '48129', name: '창원시 진해구',   region: '경상남도' },
  { code: '48170', name: '진주시',     region: '경상남도' },
  { code: '48220', name: '통영시',     region: '경상남도' },
  { code: '48240', name: '사천시',     region: '경상남도' },
  { code: '48250', name: '김해시',     region: '경상남도' },
  { code: '48270', name: '밀양시',     region: '경상남도' },
  { code: '48310', name: '거제시',     region: '경상남도' },
  { code: '48330', name: '양산시',     region: '경상남도' },
  { code: '48720', name: '의령군',     region: '경상남도' },
  { code: '48730', name: '함안군',     region: '경상남도' },
  { code: '48740', name: '창녕군',     region: '경상남도' },
  { code: '48820', name: '고성군',     region: '경상남도' },
  { code: '48840', name: '남해군',     region: '경상남도' },
  { code: '48850', name: '하동군',     region: '경상남도' },
  { code: '48860', name: '산청군',     region: '경상남도' },
  { code: '48870', name: '함양군',     region: '경상남도' },
  { code: '48880', name: '거창군',     region: '경상남도' },
  { code: '48890', name: '합천군',     region: '경상남도' },

  /* 제주특별자치도 2개 */
  { code: '50110', name: '제주시',     region: '제주특별자치도' },
  { code: '50130', name: '서귀포시',   region: '제주특별자치도' },
];

async function main() {
  let created = 0, updated = 0;
  for (const m of MUNICIPALITIES) {
    const existing = await prisma.municipality.findUnique({ where: { code: m.code } });
    if (existing) {
      await prisma.municipality.update({
        where: { code: m.code },
        data: { name: m.name, region: m.region },
      });
      updated++;
    } else {
      await prisma.municipality.create({
        data: { code: m.code, name: m.name, region: m.region, status: 'ACTIVE' },
      });
      created++;
    }
  }
  console.log(`✅ 전국 지자체 시드 완료`);
  console.log(`   - 신규: ${created}개`);
  console.log(`   - 갱신: ${updated}개`);
  console.log(`   - 총 ${MUNICIPALITIES.length}개 (광역단체 17 + 시군구 ${MUNICIPALITIES.length - 17})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
