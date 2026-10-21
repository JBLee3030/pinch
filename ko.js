// Korean UI strings: English text as it appears on screen -> Korean. See i18n.js.
// Kitchen terms the course uses in English keep the English word where it helps (Food cost %, Par).
// Paper output (recipe cards, portfolio, allergen menu) stays English and isn't listed here.

const PERIOD = { Breakfast: '조식', Lunch: '점심', Dinner: '저녁', Function: '행사', 'Prep shift': '프렙 근무', Other: '기타' };

export const KO = {
  // Shell, navigation, common actions
  'Recipes': '레시피', 'Log': '기록', 'Study': '공부', 'Settings': '설정',
  'New': '추가', 'Back': '뒤로', 'Edit': '수정', 'Save': '저장', 'Delete': '삭제', 'Remove': '삭제', 'Print': '인쇄',
  'Today': '오늘', 'Tomorrow': '내일', 'Done': '완료', 'Saved': '저장했어요', 'Copied': '복사했어요', 'Sending…': '보내는 중…',
  'Demo with sample data.': '샘플 데이터로 보는 데모예요.', 'Open Pinch': 'Pinch 열기',
  '(optional)': '(선택)', 'Notes': '메모', 'Note': '메모', 'Date': '날짜', 'Type': '종류', 'Title': '제목', 'Name': '이름', 'None': '없음',
  'Choose…': '선택…', 'Choose recipe…': '레시피 선택…', 'Choose dish…': '요리 선택…',   'Photo': '사진', 'Remove photo': '사진 삭제', 'Portions': '인분', 'portion': '인분', 'each': '개', 'Ingredient': '재료', 'Ingredients': '재료',
  'Recipe': '레시피', 'Method': '만드는 법', 'Total': '합계', 'Cost': '원가', 'Amount': '양', 'Unit': '단위', 'Qty': '양', 'Quantity': '양',
  'Search ingredients': '재료 검색', 'Search recipes or ingredients': '레시피나 재료 검색', 'Category': '카테고리', 'All': '전체',
  'Uncategorised': '미분류', '(deleted)': '(삭제됨)', 'No price': '가격 없음', 'per portion': '1인분', 'Incomplete': '미완성',
  'Print or save as PDF': '인쇄 또는 PDF로 저장', 'Breakfast': '조식', 'Lunch': '점심', 'Dinner': '저녁', 'Function': '행사',
  'Prep shift': '프렙 근무', 'Other': '기타', 'breakfast': '조식', 'lunch': '점심', 'dinner': '저녁', 'School': '학교', 'Work': '직장',

  // Allergens (FSANZ)
  'Gluten': '글루텐', 'Wheat': '밀', 'Crustacean': '갑각류', 'Mollusc': '연체류', 'Fish': '생선', 'Egg': '달걀', 'Milk': '우유',
  'Peanut': '땅콩', 'Tree nuts': '견과류', 'Sesame': '참깨', 'Soy': '대두', 'Lupin': '루핀', 'Sulphites': '아황산염',
  'contains': '포함', 'Recipe card': '레시피 카드', 'Allergens': '알레르기 유발 성분', 
  // Home
  'Home': '홈', 'Tools': '도구', 'To do': '할 일', 'All done for now': '지금은 할 일이 없어요', 'Nothing needs doing. Nice work.': '모두 끝냈어요. 잘했어요.',
  'Calculator': '계산기', 'Prep': '프렙', 'Temps': '온도', 'Allergy chart': '알레르기 표',

  // Checklists
  'Checklists': '체크리스트', 'Every day': '매일', 'Every week': '매주', 'this week': '이번 주', 'today': '오늘', 'This week': '이번 주', 'Earlier': '지난 기록',
  'Ticks are saved with the date, so the lists double as your cleaning records.': '체크는 날짜와 함께 저장돼서 청소 기록으로도 쓸 수 있어요.',
  'No checklists.': '체크리스트가 없어요.', 'Make one for opening, closing or cleaning.': '오픈, 마감, 청소용으로 만들어 보세요.',
  'New checklist': '새 체크리스트', 'Edit checklist': '체크리스트 수정', 'e.g. Closing, Pastry section': '예: 마감, 페이스트리 파트', 'How often': '주기',
  'Items, one per line': '항목 (한 줄에 하나씩)', 'Opening': '오픈', 'Closing': '마감', 'Weekly clean': '주간 청소',
          
  // Reading a recipe photo
  'Read a recipe photo': '레시피 사진으로 읽기', 'Reading the photo… this takes about 10 to 30 seconds.': '사진을 읽는 중… 10~30초 정도 걸려요.',
  'Paste a recipe link, or take a photo of a printed or handwritten recipe. Pinch fills in the form for you to check.': '레시피 링크를 붙여넣거나, 인쇄되거나 손으로 쓴 레시피를 찍으세요. Pinch가 칸을 채워 주면 확인만 하면 돼요.',
  'Reading photos is turned off in the demo.': '데모에서는 사진 읽기가 꺼져 있어요.', 'Sign in (Settings → Account) to read recipe photos.': '사진을 읽으려면 로그인하세요 (설정 → 계정과 동기화).',
  'You’re offline. Connect to the internet to read a photo.': '오프라인이에요. 사진을 읽으려면 인터넷에 연결하세요.', 'Photo reading isn’t set up yet.': '사진 읽기가 아직 설정되지 않았어요.',
  'Send a JPEG, PNG or WebP photo under 4 MB.': '4 MB 이하의 JPEG, PNG, WebP 사진을 보내세요.', 'Busy right now. Try again in a minute.': '지금 바빠요. 1분 뒤에 다시 해 보세요.',
  'This photo couldn’t be read. Try another photo, or paste the text.': '이 사진은 읽을 수 없어요. 다른 사진으로 하거나 글을 붙여넣으세요.',
  'No recipe found in that photo. Get the whole recipe in frame, in good light.': '사진에서 레시피를 찾지 못했어요. 밝은 곳에서 레시피 전체가 나오게 찍어 주세요.',
  'Couldn’t read the photo. Try again.': '사진을 읽지 못했어요. 다시 해 보세요.',

  // Sharing and favourites
  'Share': '공유', 'Send to a classmate': '동기에게 보내기', 'A link with the recipe, its sub-recipes and ingredients. They save it into their own Pinch.': '레시피, 서브 레시피, 재료가 담긴 링크예요. 받은 사람이 자기 Pinch에 저장해요.',
  'Post on Instagram': '인스타그램에 올리기', 'A numbered caption with the recipe in short, ready to paste.': '번호가 붙은 캡션에 레시피 요약이 들어가요. 붙여넣기만 하면 돼요.', 'Post number': '게시물 번호', 'Caption': '캡션',   'Instagram caption': '인스타그램 캡션',       'Copy caption': '캡션 복사',
  'Copied. Paste it into Instagram': '복사했어요. 인스타그램에 붙여넣으세요',   'Favourite': '즐겨찾기', 'Favourites': '즐겨찾기', 'Shared recipe': '공유받은 레시피', 'Shared with you': '공유받은 레시피', 'Shared with me': '공유받음', 'Shared': '공유받음',
  'This link is broken or cut short.': '링크가 깨졌거나 잘렸어요.', 'Ask for the recipe to be shared again.': '레시피를 다시 공유해 달라고 해 주세요.',
  'Save to my recipes': '내 레시피에 저장', 'Copy link': '링크 복사', 'Using Pinch from your home screen?': '홈 화면의 Pinch 앱을 쓰나요?',
  'It keeps its own recipes. Copy this link, then in the app tap New recipe and paste it under Import.': '앱은 레시피를 따로 보관해요. 이 링크를 복사한 뒤 앱에서 새 레시피를 열고 가져오기에 붙여넣으세요.',

  // Recipes tab
  'Recipe tools': '레시피 도구', 'Allergen chart': '알레르기 표', 'Kitchen calculator': '주방 계산기', 'Timers': '타이머', 'Prep list': '프렙 리스트', 'Menus': '메뉴',
  'Temperature check still open': '마치지 않은 온도 체크', 'Study cards to review': '복습할 카드',   'Welcome to Pinch': 'Pinch에 오신 걸 환영해요', 'Write a recipe.': '레시피 쓰기.',
  'Type ingredients as you go. Pinch works out cost per portion, allergens and a recipe card.': '재료를 적기만 하면 1인분 원가, 알레르기 성분, 레시피 카드를 Pinch가 계산해요.',
    'Log your services': '서비스 기록', 'to build your portfolio.': '~ 탭에 남기면 포트폴리오가 만들어져요.',
  'Write your first recipe': '첫 레시피 쓰기', 'Load sample recipes': '샘플 레시피 불러오기', 'Install on your phone': '휴대폰에 설치하기',
  'In Safari, tap': 'Safari에서', 'Share': '공유', 'Add to Home Screen': '홈 화면에 추가', '. Then always open Pinch from its icon.': '~를 누르세요. 그다음부터는 아이콘으로 Pinch를 여세요.',
  'In Chrome, tap': 'Chrome에서', 'Install app': '앱 설치', '(or Add to Home screen).': '~(또는 홈 화면에 추가)를 누르세요.',
  'Already use Pinch on another device?': '다른 기기에서 Pinch를 쓰고 있나요?', 'Sign in': '로그인', 'to bring your recipes over.': '~하면 레시피를 가져올 수 있어요.',

  // Recipe view
  'Cost per portion': '1인분 원가', 'Food cost': '원가율', 'Costing': '원가 계산', 'Target food cost': '목표 원가율',
  'Suggested price ex GST': '권장 가격 (GST 제외)', 'Suggested price inc GST': '권장 가격 (GST 포함)', 'Menu price inc GST': '메뉴 가격 (GST 포함)',
  'Actual food cost': '실제 원가율', 'Costed recipe card (PDF)': '원가 레시피 카드 (PDF)', 'Scale to': '', 'portions': '인분 기준으로 보기',
  'Sub-recipe': '서브 레시피', 'q.b.': '적당량', 'Quantity (empty for q.b., as much as needed)': '양 (비우면 적당량)', 'Log practice': '연습 기록', 'No allergens recorded': '알레르기 성분 없음', 'Fewer portions': '인분 줄이기', 'More portions': '인분 늘리기',
  "Scale by ingredient or baker's %": "재료 양이나 베이커스 %로 조정", 'Practice': '연습', 'Next time:': '다음엔:',
  'No notes': '메모 없음', 'Log an attempt': '연습 기록하기', 'Start cooking': '요리 시작', 'Used in:': '사용처:', 'Sell at': '',
  'Not rated': '평가 없음',
  'Each time you cook this, note how it went and what to change. Your notes show up when you start cooking.': '만들 때마다 어땠는지, 다음엔 뭘 바꿀지 적어 두세요. 다음에 요리를 시작하면 그 메모가 보여요.',

  // Recipe edit
  'New recipe': '새 레시피', 'Edit recipe': '레시피 수정', 'e.g. Pomodoro sauce': '예: 포모도로 소스', 'Ingredients, one per line': '재료 (한 줄에 하나씩)',
  'One per line, e.g.\n500 g tipo 00 flour\n5 eggs\n2 cloves garlic\n1/2 cup olive oil': '한 줄에 하나씩, 예:\n500 g tipo 00 flour\n5 eggs\n2 cloves garlic\n1/2 cup olive oil',
    'From a printed recipe:': '인쇄된 레시피라면:', 'open the Camera, point it at the page, tap the text icon, select the ingredients and tap Copy. Then paste here.': '카메라로 페이지를 비추고 텍스트 아이콘을 눌러 재료를 선택한 뒤 복사하세요. 그리고 여기에 붙여넣으세요.',
  'Add to recipe': '레시피에 추가', 'Ingredient or sub-recipe': '재료 또는 서브 레시피', '+ Add ingredient': '+ 재료 추가', 'Paste a list': '목록 붙여넣기',
  'Add one at a time': '하나씩 추가', 'More details': '자세히', 'category, pricing, batch yield': '카테고리, 가격, 배치 완성량', 'Pasta, Sauce…': '파스타, 소스…',
  'Source': '출처', 'My own': '내 레시피', 'Web': '웹', 'Target food cost %': '목표 원가율 %', 'Batch yield': '배치 완성량', '(for sub-recipes)': '(서브 레시피용)',
  'e.g. 2.2': '예: 2.2', 'Yield unit': '완성량 단위', 'Import from a website': '웹사이트에서 가져오기', 'Import a recipe': '레시피 가져오기', 'Paste a recipe link': '레시피 링크 붙여넣기',
  'Recipe link': '레시피 링크', 'Import': '가져오기', 'Find a recipe on Google, copy its link and paste it here. Works with most recipe sites.': '구글에서 레시피를 찾아 링크를 복사해 붙여넣으세요. 대부분의 레시피 사이트에서 돼요.',
  'Paste a link first.': '먼저 링크를 붙여넣으세요.', 'Reading the recipe…': '레시피 읽는 중…', 'Paste at least one line.': '한 줄 이상 붙여넣으세요.',
  'From school': '학교 레시피', 'From work': '직장 레시피', 'From the web': '웹 레시피',

  // Attempts
  'How did it go?': '어땠나요?', 'Attempt': '연습 기록', 'Rating': '평점', 'Next time': '다음엔',
  'Taste, texture, timing, what chef said…': '맛, 식감, 타이밍, 셰프 피드백…', 'e.g. Salt the pasta water more. Pull the sauce off earlier.': '예: 파스타 물에 소금을 더. 소스를 더 일찍 불에서 내리기.',
  'Delete this attempt?': '이 연습 기록을 삭제할까요?',

  // Menus
  'No menus yet.': '아직 메뉴가 없어요.', 'Group dishes into a menu, add what each sold, and see which to keep, push, re-cost or drop.': '요리를 메뉴로 묶고 판매량을 넣으면, 유지할지, 밀어줄지, 원가를 다시 잡을지, 뺄지 알려줘요.',
  'Untitled menu': '이름 없는 메뉴', 'New menu': '새 메뉴', 'Menu': '메뉴', 'Food cost on sales': '매출 대비 원가율', 'Menu engineering': '메뉴 엔지니어링',
  'More profitable →': '수익성 높음 →', 'More popular →': '인기 높음 →', 'Star': '스타', 'Plowhorse': '플라우호스', 'Puzzle': '퍼즐', 'Dog': '도그',
  'Popular and profitable. Keep it, feature it, protect the recipe.': '인기도 수익성도 높아요. 유지하고 앞세우고, 레시피를 지키세요.',
  'Popular, low margin. Trim the cost or portion, or nudge the price up.': '인기는 높지만 마진이 낮아요. 원가나 양을 줄이거나 가격을 조금 올리세요.',
  'Profitable but slow. Move it up the menu, rename it, have staff recommend it.': '수익성은 좋지만 잘 안 팔려요. 메뉴 위쪽으로 옮기거나 이름을 바꾸고, 직원이 추천하게 하세요.',
  'Slow and low margin. Replace it or rework it.': '잘 안 팔리고 마진도 낮아요. 빼거나 다시 만드세요.',
  'Menu name': '메뉴 이름', 'e.g. Lunch, Week 3 Italian': '예: 점심, 3주차 이탈리안', 'Sales period': '판매 기간', 'e.g. 1 to 7 Oct': '예: 10월 1일~7일',
  'Dishes': '요리', 'Dish': '요리', 'Price inc GST': '가격 (GST 포함)', 'Sold': '판매량', '+ Add dish': '+ 요리 추가',
  "Price defaults to the recipe's menu price. Sold is how many went out in the period.": '가격은 레시피의 메뉴 가격이 기본값이에요. 판매량은 기간 동안 나간 개수예요.',
  'Allergen menu to print': '인쇄용 알레르기 메뉴', 'Delete menu': '메뉴 삭제', 'Allergen menu': '알레르기 메뉴',
  'Add how many of each dish sold to see the analysis.': '요리별 판매량을 넣으면 분석이 보여요.', 'Check prices.': '가격을 확인하세요.', 'this menu': '이 메뉴',

  // Prep list
  "What's on?": '오늘 뭘 하나요?', '+ Add recipe': '+ 레시피 추가', 'Use order list': '발주 리스트에서', 'Add recipes first.': '먼저 레시피를 추가하세요.',
  'Choose what you’re cooking and how many portions.': '무엇을 몇 인분 만드는지 고르세요.', 'Progress': '진행', 'Weigh out': '계량', '(from above)': '(위에서 만든 것)',
  'Clear ticks': '체크 지우기', 'Clear all ticks?': '체크를 모두 지울까요?',

  // Timers and cooking mode
  'Quick start': '빠른 시작', 'Custom': '직접 설정', 'e.g. Stock, Bread proof': '예: 스톡, 빵 발효', 'Minutes': '분', 'Seconds': '초', 'Start timer': '타이머 시작',
  "Timers keep running while you use the rest of Pinch. Keep the app open: a locked phone can't ring.": '다른 화면을 봐도 타이머는 계속 돌아가요. 앱은 켜 두세요: 화면이 잠기면 알람이 울리지 않아요.',
  'Next step': '다음 단계', 'Finish': '완료', 'No method yet.': '아직 만드는 법이 없어요.', 'Add the steps': '단계 추가', 'to cook step by step.': '~하면 단계별로 요리할 수 있어요.',
  'No ingredients yet.': '아직 재료가 없어요.',

  // Scale
  'Scale': '배율', 'I have…': '가진 양으로', "Baker's %": '베이커스 %', 'I have': '가진 양', 'e.g. 3': '예: 3', 'Base (100%)': '기준 (100%)', 'Base weight (g)': '기준 무게 (g)',
  'How far does it go?': '얼마나 만들 수 있을까요?', 'This recipe has no ingredients yet.': '이 레시피에는 아직 재료가 없어요.', 'That makes': '만들 수 있는 양',
  "Baker's % needs weights (g or kg). Add them to the ingredients first.": '베이커스 %는 무게(g 또는 kg)가 필요해요. 먼저 재료에 무게를 넣으세요.',
  'Pick a base measured in g, kg or ml.': 'g, kg, ml로 잰 재료를 기준으로 고르세요.', 'Total weight': '총무게', '%': '%',
  'Volumes use ingredient densities; one egg counts as 50 g.': '부피는 재료 밀도로 환산하고, 달걀 1개는 50 g으로 계산해요.',

  // Kitchen calculator
  'Cups and spoons to grams': '컵·스푼을 그램으로', 'Measures': '계량 기준', 'Australian': '호주식', 'US': '미국식', 'Measure': '계량',
  'cup': '컵', 'tbsp': '큰술', 'tsp': '작은술', 'Plain flour': '중력분', 'Tipo 00 flour': 'Tipo 00 밀가루', 'Bread flour': '강력분', 'Semolina': '세몰리나',
  'Caster sugar': '캐스터 슈거', 'White sugar': '백설탕', 'Brown sugar (packed)': '흑설탕 (꾹 눌러 담기)', 'Icing sugar': '슈거파우더', 'Butter': '버터',
  'Cocoa powder': '코코아 파우더', 'Rolled oats': '압착 귀리', 'Rice (uncooked)': '쌀 (생쌀)', 'Arborio rice': '아르보리오 쌀', 'Breadcrumbs': '빵가루',
  'Grated parmesan': '간 파르메산', 'Honey': '꿀', 'Cream': '생크림', 'Water': '물', 'Olive oil': '올리브유', 'Table salt': '식탁염', 'Kosher salt': '코셔 소금',
  'Oven temperature': '오븐 온도', 'Weight and volume': '무게와 부피', 'fl oz (US)': 'fl oz (미국)', 'Enter an amount, e.g. 1 1/2': '양을 입력하세요. 예: 1 1/2',
  'Cup weights are approximate (spooned and levelled). Weigh when it matters.': '컵 무게는 대략이에요(숟가락으로 담아 평평하게). 중요할 땐 저울로 재세요.',

  // Study and exams
  'My cards': '내 카드', 'Make a card': '카드 만들기', 'Add a card': '카드 추가', 'New card': '새 카드', 'Edit card': '카드 수정', 'Deck': '카드 묶음',
  'Make cards from class: theory notes, what chef stressed, a photo of the plating.': '수업 내용으로 카드를 만드세요: 이론 노트, 셰프가 강조한 점, 플레이팅 사진.',
  'e.g. Week 3 theory': '예: 3주차 이론', 'Question': '질문', '(or a term)': '(또는 용어)', 'Answer': '답', 'e.g. What does CCP stand for?': '예: CCP는 무엇의 약자일까요?',
  'A photo shows with the answer: a plating, a cut, a page of class notes.': '사진은 답과 함께 보여요: 플레이팅, 썰기, 수업 노트 등.', 'Delete this card?': '이 카드를 삭제할까요?',
  // Card diagrams
  'cold': '냉장·냉동', 'danger zone': '위험 구간', 'hot': '온장', 'use or refrigerate': '사용하거나 냉장', 'use it': '바로 사용', 'throw it out': '폐기',
  'reheat to 75 °C, then hold at 60 °C or above': '75 °C로 재가열 후 60 °C 이상 유지', '1 to 2 mm thick': '두께 1~2 mm', '7 sides': '7면', '70 °C +': '70 °C 이상',
  'milk': '우유', 'white roux': '화이트 루', 'white stock': '화이트 스톡', 'blond roux': '블론드 루', 'brown stock': '브라운 스톡', '+ mirepoix, tomato': '+ 미르푸아, 토마토',
  'brown roux': '브라운 루', 'egg yolks': '달걀노른자', 'clarified butter': '정제 버터', '+ lemon': '+ 레몬', 'tomatoes': '토마토', 'aromatics, stock': '향신 채소, 스톡',
  'cheese': '치즈', 'tarragon, shallot': '타라곤, 샬롯', 'and vinegar reduction': '식초 리덕션', 'reduce by half': '반으로 졸이기', 'chicken velouté': '치킨 벨루테', 'cream': '생크림',
  'oil': '오일', 'acid': '산 (식초·레몬즙)', 'flour': '밀가루', 'fat': '지방', 'by weight': '무게 기준', 'tipo 00 flour': 'Tipo 00 밀가루', 'egg': '달걀', 'water': '물', 'salt': '소금',
  'dried pasta': '건면', 'hot stock': '뜨거운 스톡', 'rice': '쌀', 'by volume, added gradually': '부피 기준, 조금씩 넣기', 'egg yolk': '달걀노른자',
  'All caught up': '모두 끝냈어요', 'Coming up': '다가오는 일정', 'Add an exam or assessment': '시험·평가 추가', 'Decks': '카드 묶음',
  'Knife cuts': '칼 썰기 (Knife cuts)', 'Food safety temperatures': '식품 안전 온도', 'Steak doneness': '스테이크 굽기', 'Mother sauces': '모체 소스 (Mother sauces)',
  'Ratios and basics': '비율과 기본', 'Kitchen terms': '주방 용어',
  'Common teaching sizes. Colleges and chefs vary, so check the standard your assessor uses.': '흔히 가르치는 크기예요. 학교와 셰프마다 달라서, 평가자가 쓰는 기준을 확인하세요.',
  'Australia: FSANZ Standard 3.2.2 and state food authority guidance.': '호주 FSANZ 기준 3.2.2와 주 식품 당국 지침이에요.',
  'Core temperatures for beef and lamb, a common chef guide. Allow for 2 to 5 °C carry-over while resting.': '소·양고기 중심 온도, 셰프들이 흔히 쓰는 기준이에요. 레스팅하면서 2~5 °C 더 오르는 걸 감안하세요.',
  'The five classical (Escoffier) mother sauces and common derivatives.': '고전(에스코피에) 5대 모체 소스와 대표 파생 소스예요.',
  'Starting points by weight unless noted. Adjust to taste and recipe.': '따로 적지 않으면 무게 기준 출발점이에요. 맛과 레시피에 맞게 조절하세요.',
  'Italian and French terms you hear on the pass.': '패스에서 듣는 이탈리아어·프랑스어 용어예요.',
  'Cards you get right come back after 1, 3, 7, 14 and 30 days. Ones you miss come straight back.': '맞힌 카드는 1, 3, 7, 14, 30일 뒤에 다시 나와요. 틀린 카드는 바로 다시 나와요.',
  'Study this deck': '이 묶음 공부하기', 'Tap to show the answer': '눌러서 답 보기', 'Show answer': '답 보기', 'Again': '다시', 'Got it': '알았어요',
  'Session complete': '세션 완료', 'Nothing missed.': '틀린 카드가 없어요.', 'Learned': '익힘',
  'New exam': '새 시험', 'Exam': '시험', 'Practical': '실기', 'Theory': '이론', 'Assignment': '과제', 'e.g. Practical: pasta and sauces': '예: 실기: 파스타와 소스',
  'Dishes to practise': '연습할 요리', 'Practise each dish': '요리별 연습 횟수', 'Ready': '준비됨', 'Practise': '연습 필요',
  "What's assessed, equipment, time limit…": '평가 내용, 준비물, 제한 시간…', 'Add the recipes first, then pick them here.': '먼저 레시피를 추가한 뒤 여기서 고르세요.',
  'Delete this exam? Practice records stay.': '이 시험을 삭제할까요? 연습 기록은 남아요.',

  // Ingredients
  'Prices are optional: add them when a recipe needs costing. Allergens set here show on every recipe that uses the ingredient.': '가격은 선택이에요. 원가 계산이 필요한 레시피가 있을 때 넣으세요. 여기서 정한 알레르기 성분은 이 재료를 쓰는 모든 레시피에 표시돼요.',
  'They are added for you as you write recipes.': '레시피를 쓰면 재료가 자동으로 추가돼요.',
  'Allergens come from your ingredient list. Always check supplier labels.': '알레르기 성분은 재료 목록 기준이에요. 공급업체 라벨을 꼭 확인하세요.',
  'Based on your ingredient list. Always check supplier labels.': '재료 목록 기준이에요. 공급업체 라벨을 꼭 확인하세요.',
  'Type or paste. Amounts and units are read for you, and names are matched to your ingredients. No amount (oil, salt, to taste) is fine: it\'s saved as q.b.': '입력하거나 붙여넣으세요. 양과 단위를 읽고, 이름은 기존 재료와 맞춰 줘요. 양이 없는 재료(오일, 소금, 기호에 따라)도 괜찮아요. 적당량으로 저장돼요.',
  'Choose an ingredient…': '재료 선택…', 'Choose an ingredient above to save this yield to it.': '위에서 재료를 고르면 이 수율을 그 재료에 저장해요.',
  'An ingredient was deleted': '재료가 삭제됐어요', 'Practise it.': '연습하기.', 'After each cook, rate it and note what to change next time.': '만들 때마다 별점을 주고 다음엔 뭘 바꿀지 적어 두세요.',
  'Yield test': '수율 테스트 (Yield test)',   'No ingredients yet.': '아직 재료가 없어요.',     'Edit ingredient': '재료 수정', 'New ingredient': '새 재료', 'Price (AUD)': '가격 (AUD)', 'Add later': '나중에 입력', 'Per': '단위',
  'Yield %': '수율 %', '(usable after trimming/peeling)': '(손질 후 쓸 수 있는 비율)', 'Run a yield test': '수율 테스트 하기', 'Used in': '사용하는 레시피',
  'Not used in any recipe yet.': '아직 어떤 레시피에도 쓰이지 않아요.',

  // Yield test
  'Bought': '구매량', 'e.g. 5': '예: 5', 'Price per': '가격 /', 'Usable after trimming': '손질 후 사용 가능량', 'e.g. 3.6': '예: 3.6', 'Trim': '트림',
  '(optional; add a $ value per kg for anything you reuse, like bones for stock)': '(선택. 스톡용 뼈처럼 다시 쓰는 건 kg당 가치를 넣으세요)', 'e.g. Bones, fat': '예: 뼈, 지방',
  'Trim weight': '트림 무게', '$ value': '$ 가치', 'Value per kg if reused': '재사용 시 kg당 가치', '+ Add trim': '+ 트림 추가',
  'Enter what you bought and what was usable after trimming.': '구매량과 손질 후 사용 가능량을 넣으세요.', 'Usable weight can’t be more than what you bought.': '사용 가능량은 구매량보다 많을 수 없어요.',
  'Yield': '수율', '⚠ Usable weight plus trim is more than you bought. Check the weights.': '⚠ 사용 가능량과 트림을 더한 값이 구매량보다 많아요. 무게를 확인하세요.',
  'Total cost': '총원가', 'Value of reused trim': '재사용 트림 가치', 'Usable': '사용 가능량', 'Unaccounted loss': '알 수 없는 손실',
  
  // Service log
  'What did you cook?': '무엇을 만들었나요?', 'Search your recipes': '내 레시피 검색', 'How did each go?': '요리별로 어땠나요?',
  'Add your class recipes to the book, then tick them here.': '수업 레시피를 레시피북에 넣으면 여기서 체크할 수 있어요.',
  'Other dishes': '그 밖의 요리', '(not in your book)': '(레시피북에 없는 것)', 'e.g. staff meal': '예: 스태프 밀',
  "(saved with each dish's practice)": '(요리별 연습 기록에도 저장돼요)', 'Class service': '수업 서비스',
  'From your class log.': '수업 기록에서 온 연습이에요.', 'Open the log': '기록 열기',
  'Delete this service entry? Its practice records on recipes go too.': '이 서비스 기록을 삭제할까요? 레시피에 남은 연습 기록도 함께 지워져요.',
  'Class log': '수업 기록', 'Log tools': '기록 도구', 'Temp log': '온도 기록', 'Portfolio': '포트폴리오', 'School service periods': '학교 서비스 횟수',
   'Takes a few seconds': '몇 초면 돼요', 'Same as last time': '지난번과 같음', 'No venue': '장소 없음',
  'Log every class service: what you cooked, your station and what chef said.': '수업 서비스마다 기록하세요: 무엇을 만들었고, 어느 스테이션이었고, 셰프가 뭐라고 했는지.', 'Kitchen': '주방', 'e.g. AMCA training kitchen': '예: AMCA 실습 주방',
  'Edit service': '서비스 수정', 'New service': '새 서비스', 'Venue': '장소',  'Service': '서비스',
  'Hours': '시간', 'Station': '스테이션', 'Dishes cooked': '만든 요리', 'Chef feedback / what to improve': '셰프 피드백 / 개선할 점', 'Tagliatelle al ragù ×18…': 'Tagliatelle al ragù ×18…',
  'Delete this service entry?': '이 서비스 기록을 삭제할까요?',

  // Temperatures
  'Checks today': '오늘 체크', 'Failed today': '오늘 부적합', 'PASS': '적합', 'FAIL': '부적합', 'OPEN': '진행 중', 'Edit temp check': '온도 체크 수정', 'New temp check': '새 온도 체크',
  'Check': '체크 항목', 'Fridge / cool room': '냉장고 / 쿨룸', 'Freezer': '냉동고', 'Delivery, chilled': '입고, 냉장', 'Delivery, frozen': '입고, 냉동', 'Hot holding': '온장 보관',
  'Cooking (core)': '조리 (중심 온도)', 'Reheating (core)': '재가열 (중심 온도)', 'Cooling (2-stage)': '냉각 (2단계)', 'Equipment or food': '장비 또는 음식',
  'Walk-in cool room, Bain-marie, Beef ragù…': '워크인 쿨룸, 중탕기, 소고기 라구…', 'Time': '시간', 'Start': '시작', 'Stage 1': '1단계', 'Stage 2': '2단계',
  '≤ 21 °C within 2 h': '2시간 안에 ≤ 21 °C', '≤ 5 °C within 6 h of start': '시작 후 6시간 안에 ≤ 5 °C', 'Corrective action': '시정 조치', 'What you did if it failed': '부적합일 때 한 조치',
  'Enter temperature': '온도를 입력하세요', 'Add start time and temperature': '시작 시간과 온도를 입력하세요', 'Cooled within limits': '기준 안에 냉각됐어요',
  'Check again within 2 h of start (≤ 21 °C)': '시작 후 2시간 안에 다시 체크 (≤ 21 °C)', 'Check again within 6 h of start (≤ 5 °C)': '시작 후 6시간 안에 다시 체크 (≤ 5 °C)',
  'Stage 1: must be ≤ 21 °C within 2 h of start': '1단계: 시작 후 2시간 안에 ≤ 21 °C여야 해요', 'Stage 2: must be ≤ 5 °C within 6 h of start': '2단계: 시작 후 6시간 안에 ≤ 5 °C여야 해요',
  '60 → 21 °C within 2 h → 5 °C within 6 h': '60 → 2시간 안에 21 °C → 6시간 안에 5 °C', 'Unknown check type': '알 수 없는 체크 종류',
  'Record fridge, freezer, delivery, hot-holding, cooking and cooling temperatures. Each check is marked PASS or FAIL against food safety limits.': '냉장, 냉동, 입고, 온장, 조리, 냉각 온도를 기록하세요. 체크마다 식품 안전 기준으로 적합·부적합이 표시돼요.',
  'This check failed and has no corrective action. Save anyway?': '부적합인데 시정 조치가 없어요. 그래도 저장할까요?', 'Delete this temperature record?': '이 온도 기록을 삭제할까요?',

  // Portfolio
  'Your details': '내 정보', 'Name:': '이름:', '(from Settings)': '(설정에서)', 'add your name in Settings': '설정에서 이름 추가', 'Headline': '한 줄 소개',
  'Commis chef · Cert IV Kitchen Management': 'Commis chef · Cert IV Kitchen Management', 'Contact': '연락처', 'email · phone · Instagram': '이메일 · 전화 · 인스타그램',
  'About me': '자기소개', "What you cook, what you're learning, what you're looking for.": '어떤 요리를 하고, 무엇을 배우고, 어떤 자리를 찾는지.', 'Featured dishes': '대표 요리',
  '(no photo)': '(사진 없음)', 'Show costing on dishes': '요리에 원가 표시', 'No recipes yet.': '아직 레시피가 없어요.',

  // Password reset
  'Reset password': '비밀번호 재설정', 'New password': '새 비밀번호', 'Repeat new password': '새 비밀번호 확인', 'Set new password': '새 비밀번호 설정',
  'Reset links work once and expire after a while. Request a new one from': '재설정 링크는 한 번만 쓸 수 있고 시간이 지나면 만료돼요. 새 링크는 여기서 요청하세요:',
  'Settings → Forgot password?': '설정 → 비밀번호를 잊으셨나요?', 'The passwords don’t match.': '비밀번호가 서로 달라요.', 'Saving…': '저장 중…',
  'Password updated. You’re signed in.': '비밀번호를 바꿨어요. 로그인됐어요.', 'Go to my recipes': '내 레시피로', 'Password updated.': '비밀번호를 바꿨어요.',
  'Now open Pinch from your home screen and sign in with the new password.': '이제 홈 화면에서 Pinch를 열고 새 비밀번호로 로그인하세요.',
  'This reset link is no longer valid. Request a new one from Settings → Forgot password?': '이 재설정 링크는 더 이상 쓸 수 없어요. 설정 → 비밀번호를 잊으셨나요?에서 새로 요청하세요.',

  // Settings
  'Language': '언어', 'Account & sync': '계정과 동기화', 'Turned off in the demo.': '데모에서는 꺼져 있어요.', 'to use your own data.': '~를 누르면 내 데이터를 쓸 수 있어요.',
  'You': '내 정보', 'Your name': '이름', '(shown on recipe cards)': '(레시피 카드에 표시)', 'Default target food cost %': '기본 목표 원가율 %',
  'School service periods required': '필요한 학교 서비스 횟수', 'Backup': '백업', 'A backup file is a copy you keep yourself, in Files, Drive or email.': '백업 파일은 파일 앱, 드라이브, 이메일 등에 직접 보관하는 사본이에요.',
  'Last backup:': '마지막 백업:', 'never': '없음', 'Export backup': '백업 내보내기', 'Feedback': '피드백', "What's missing, confusing or broken?": '부족하거나 헷갈리거나 고장 난 게 있나요?',
  "e.g. I'd like to…": '예: 이런 기능이 있으면…', 'Send feedback': '피드백 보내기', 'Invite classmates': '동기 초대하기',
  'Pinch is free. Share the link. Everyone gets their own private recipe book.': 'Pinch는 무료예요. 링크를 공유하세요. 각자 자기만의 레시피 북을 가져요.', 'Share Pinch': 'Pinch 공유',
  'Signed in as': '로그인 계정:', 'Syncing…': '동기화 중…', 'Not synced yet': '아직 동기화 안 됨', 'Sync now': '지금 동기화', 'Sign out': '로그아웃',
  'Optional. Sign in to back up to the cloud and use Pinch on more than one device. Without an account, data stays on this phone only.': '선택 사항이에요. 로그인하면 클라우드에 백업되고 여러 기기에서 Pinch를 쓸 수 있어요. 계정이 없으면 데이터는 이 휴대폰에만 있어요.',
  'Email': '이메일', 'Password': '비밀번호', '(8+ characters)': '(8자 이상)', 'Create account': '계정 만들기', 'Forgot password?': '비밀번호를 잊으셨나요?',
  'Synced data is stored with Supabase in Sydney. Only you can read it.': '동기화된 데이터는 시드니의 Supabase에 저장되고, 본인만 볼 수 있어요.',
  'Creating account…': '계정 만드는 중…', 'Signing in…': '로그인 중…', 'Enter your email first, then tap Forgot password.': '먼저 이메일을 입력하고 비밀번호를 잊으셨나요?를 누르세요.',
  'If there is an account for that email, a reset link is on its way. Open it on this phone.': '그 이메일로 된 계정이 있으면 재설정 링크를 보냈어요. 이 휴대폰에서 여세요.',
  'Sign out? Your data stays on this phone.': '로그아웃할까요? 데이터는 이 휴대폰에 남아요.', 'Thanks, got it!': '고마워요, 잘 받았어요!',
  'You are offline. Try again later.': '오프라인이에요. 나중에 다시 시도하세요.', 'Link copied': '링크를 복사했어요',
  'Replace ALL data on this phone with this backup?': '이 휴대폰의 모든 데이터를 이 백업으로 바꿀까요?', 'Backup restored.': '백업을 복원했어요.',

  // Errors from sync and recipe import
  'Not signed in': '로그인되어 있지 않아요', 'Can’t reach the Pinch server right now. Try again in a few minutes.': '지금 Pinch 서버에 연결할 수 없어요. 몇 분 뒤에 다시 해 보세요.', 'You’re offline. Connect to the internet and try again.': '오프라인이에요. 인터넷에 연결한 뒤 다시 해 보세요.', 'Invalid login credentials': '이메일 또는 비밀번호가 맞지 않아요', 'User already registered': '이미 가입된 이메일이에요',
  'Email not confirmed': '이메일 인증이 안 됐어요', 'Offline. Pinch will sync when you are back online.': '오프라인이에요. 다시 연결되면 Pinch가 동기화해요.',
  'Account created, but email confirmation is on. Turn off "Confirm email" in Supabase.': '계정은 만들었지만 이메일 인증이 켜져 있어요. Supabase에서 "Confirm email"을 끄세요.',
  'You’re offline. Connect to the internet to import a recipe.': '오프라인이에요. 레시피를 가져오려면 인터넷에 연결하세요.', 'Recipe import isn’t set up yet.': '레시피 가져오기가 아직 설정되지 않았어요.',
  'That doesn’t look like a web page link.': '웹페이지 링크가 아닌 것 같아요.', 'The site took too long to answer.': '사이트 응답이 너무 느려요.', 'Couldn’t open that page.': '그 페이지를 열 수 없어요.',
  'No recipe found on that page. Try the page of a single recipe, or copy the ingredients and paste them instead.': '그 페이지에서 레시피를 못 찾았어요. 레시피 하나만 있는 페이지로 해 보거나, 재료를 복사해 붙여넣으세요.',
  'This site doesn’t let apps read its recipes. Copy the ingredients from the page and paste them instead.': '이 사이트는 앱이 레시피를 읽지 못하게 막아요. 페이지에서 재료를 복사해 붙여넣으세요.',
  'A sub-recipe was deleted': '서브 레시피가 삭제됐어요',

  // Work flow plan
  'Work flow': '워크플로우', 'Work flow plan': '워크플로우 플랜', 'Form': '양식', 'Your school\'s form': '학교 양식',
  'Add the Work Flow Plan Word file (.docx) once. Pinch fills it in for every practical.': 'Work Flow Plan 워드 파일(.docx)을 한 번만 올리면 실습 때마다 Pinch가 채워줘요.',
  'Change form': '양식 바꾸기', 'Choose the Word file': '워드 파일 선택', 'From your book': '내 레시피북에서',
  'Or paste recipes': '또는 레시피 붙여넣기', 'Paste recipes': '레시피 붙여넣기', 'Your details': '내 정보',
  'Student ID': '학번', 'Trainer': '트레이너', 'Group': '그룹', 'Assessment no.': '평가 번호', 'Time plan': '시간 계획',
  'Download Word file': '워드 파일 받기', 'Add your school\'s form first.': '학교 양식을 먼저 올려주세요.',
  'Tick recipes or paste them above. The time plan shows here.': '위에서 레시피를 고르거나 붙여넣으세요. 시간 계획이 여기 나와요.',
  'The form has 7 recipe cards. Only the first 7 go in.': '양식에 레시피 카드가 7장이라 앞의 7개만 들어가요.',
  'Not a Word file (.docx)': '워드 파일(.docx)이 아니에요', 'This Word file has no time plan or recipe cards': '이 워드 파일에는 시간 계획표나 레시피 카드가 없어요', };

const ALLERGEN_LIST = /^((?:Gluten|Wheat|Crustacean|Mollusc|Fish|Egg|Milk|Peanut|Tree nuts|Sesame|Soy|Lupin|Sulphites)(?:, (?:Gluten|Wheat|Crustacean|Mollusc|Fish|Egg|Milk|Peanut|Tree nuts|Sesame|Soy|Lupin|Sulphites))+)$/;
const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
const portions = q => `${q}인분`;
const dur = (h, m, s) => [h && `${h}시간`, m && `${m}분`, s && `${s}초`].filter(Boolean).join(' ');

// [pattern, Korean]: $1… are the captured parts, themselves translated. A function gets them as arguments.
export const KO_PATTERNS = [
  // Units, amounts, durations
  [/^([\d.]+) portions?$/, q => portions(q)],
  [/^(.+) · ([\d.]+) portions?$/, (c, q) => `${c} · ${portions(q)}`],
  [/^([\d.]+) each$/, '$1개'],
  [/^(?:(\d+) h)?(?: ?(\d+) min)?(?: ?(\d+) s)?$/, dur],
  [/^([\d.]+) hours?$/, '$1시간'],
  [/^([\d.]+) h$/, '$1시간'],
  [/^(\d+) times?$/, '$1회'],
  [/^(\d) stars?$/, '$1점'],
  [/^([\d.]+) out of 5$/, '5점 만점에 $1점'],
  [/^per (\S+)$/, '$1당'],
  [/^(\d+) days$/, '$1일 남음'],
  [/^(\d+) days ago$/, '$1일 전'],
  [/^(\d+) of (\d+)$/, '$2개 중 $1개'],
  [/^⚠ (.+)$/, '⚠ $1'],
  [ALLERGEN_LIST, list => list.split(', ').map(a => KO[a] ?? a).join(', ')],

  // Costing problems (calc.js)
  [/^Price missing: (.+)$/, '가격 없음: $1'],
  [/^(.+): can't convert (\S+) to (\S+)$/, '$1: $2를 $3(으)로 환산할 수 없어요'],
  [/^(.+): circular sub-recipe$/, '$1: 서브 레시피가 서로를 참조해요'],
  [/^(.+): set its batch yield in (\S+), or use portions$/, '$1: 배치 완성량을 $2로 넣거나 인분 단위를 쓰세요'],

  // Today and dates with a service
  [/^Log today['’]s (breakfast|lunch|dinner) service$/, '오늘 $1 서비스 기록하기'],
  [/^(Breakfast|Lunch|Dinner) logged\. Log another$/, '$1 기록 완료. 하나 더 기록하기'],
  [/^(.+), (\d+) to practise$/, '$1, 연습 필요 $2개'],
  [/^(.+), (Breakfast|Lunch|Dinner|Function|Prep shift|Other)$/, (d, p) => `${d} · ${p}`],

  // Recipes
  [/^(.+?) · (From school|From work|My own|From the web)(?: · Yields (.+))?$/, (c, s, y) => [c, s, y && `완성량 ${y}`].filter(Boolean).join(' · ')],
  [/^(.+) · From$/, '$1 · 출처:'],
  [/^· Yields (.+)$/, '· 완성량 $1'],
  [/^for ([\d.]+%) food cost$/, '~에 팔면 원가율 $1'],
  [/^at (\$\S+)$/, '(메뉴 가격 $1)'],
  [/^(\d+) things to fix in Costing$/, '원가 계산에서 고칠 것 $1개'],
  [/^Batch cost \((.+)\)$/, '배치 원가 ($1)'],
  [/^([\d.]+) average, (\d+) attempts?$/, '평균 $1점, $2회 연습'],
  [/^(\d+) attempts?$/, '$1회 연습'],
  [/^Imported from (.+): (\d+) ingredients, (\d+) steps(, photo)?\. Check it, then Save\.$/, (site, i, s, p) => `${site}에서 가져왔어요: 재료 ${i}개, 단계 ${s}개${p ? ', 사진' : ''}. 확인하고 저장하세요.`],
  [/^Added (\d+) ingredients: (\d+) already in your list, (\d+) new\.(?: (\d+) highlighted row\(s\) need a name\.)?$/, (a, p, nw, u) => `재료 ${a}개 추가: 기존 재료 ${p}개, 새 재료 ${nw}개.${u ? ` 표시된 ${u}줄은 이름을 확인하세요.` : ''}`],
  [/^Check this line: "(.*)"$/, '이 줄을 확인하세요: "$1"'],
  [/^Add an amount for the highlighted ingredient, or remove it with ×\.$/, '표시된 재료에 양을 넣거나 ×로 지우세요.'],
  [/^Add an amount for the (\d+) highlighted ingredients, or remove them with ×\.$/, '표시된 재료 $1개에 양을 넣거나 ×로 지우세요.'],
  [/^"(.+)" is a sub-recipe in (\d+) recipe\(s\)\. Their costing will show a warning\. Delete anyway\?$/, '"$1"은(는) 레시피 $2개의 서브 레시피예요. 그 레시피들의 원가에 경고가 떠요. 그래도 삭제할까요?'],
  [/^"(.+)" is used in (\d+) recipe\(s\)\. Their costing will show a warning\. Delete anyway\?$/, '"$1"은(는) 레시피 $2개에 쓰여요. 그 레시피들의 원가에 경고가 떠요. 그래도 삭제할까요?'],
  [/^Delete "(.+)"\? The recipes stay\.$/, '"$1"을(를) 삭제할까요? 레시피는 남아요.'],
  [/^Delete "(.+)"\?$/, '"$1"을(를) 삭제할까요?'],

  // Menus
  [/^(?:(.+) · )?(\d+) dish(?:es)?$/, (p, c) => [p, `요리 ${c}개`].filter(Boolean).join(' · ')],
  [/^(\d+) sold, (\S+) ex GST, (\S+) contribution margin$/, '$1개 판매, 매출 $2 (GST 제외), 공헌이익 $3'],
  [/^Average margin (\S+)\. Popular means at least (\S+) of sales\.$/, '평균 마진 $1. 판매 비중 $2 이상이면 인기 메뉴예요.'],
  [/^(\S+) margin · (\S+)$/, '마진 $1 · $2'],
  [/^(\S+) cost$/, '원가 $1'],

  // Prep, timers, cooking
  [/^Make ([\d.]+ \S+ \(.+\)|.+?)(?:, about (.+) of cooking time)?$/, (m, t) => `${m} 만들기${t ? `, 조리 시간 약 ${t}` : ''}`],
  [/^([\d.]+ \S+) \(([\d.]+) portions?\)$/, (a, q) => `${a} (${portions(q)})`],
  [/^Start (.+) timer$/, '$1 타이머 시작'],
  [/^Step (\d+) of (\d+)$/, '$2단계 중 $1단계'],
  [/^Step (\d+): (.+)$/, '$1단계: $2'],
  [/^Steps \((\d+)\)$/, '단계 ($1)'],
  [/^Ingredients \((\d+)\)$/, '재료 ($1)'],
  [/^Last time \((.+)\), you noted:$/, '지난번($1) 메모:'],
  [/^(Stop|Dismiss) timer (.+)$/, (a, l) => `${l} 타이머 ${a === 'Stop' ? '멈추기' : '닫기'}`],
  [/^(.+): done$/, '$1: 완료'],
  [/^(.+) (\d+:\d\d(?::\d\d)?)$/, '$1 $2'],

  // Scale and calculator
  [/^(.+) · makes (.+)$/, '$1 · $2 분량'],
  [/^Enter how much (.+) you have\.$/, '가진 $1 양을 입력하세요.'],
  [/^(\S+) doesn’t convert to (\S+) for this ingredient\.$/, '이 재료는 $1를 $2(으)로 환산할 수 없어요.'],
  [/^×([\d.]+) of the recipe\. You’ll need:$/, '레시피의 ×$1. 필요한 양:'],
  [/^Base (.+) = 100%$/, '기준 $1 = 100%'],
  [/^([\d.]+) ml (Australian|US) measure, (.+) at ([\d.]+) g\/ml$/, (ml, sys, what, d) => `${ml} ml (${sys} 계량), ${KO[cap(what)] ?? what} 기준 ${d} g/ml`],
  [/^Fan-forced oven: about (-?\d+) °C$/, '컨벡션(팬) 오븐: 약 $1 °C'],

  // Study and exams
  [/^(\d+) to review$/, '복습 $1장'],
  [/^(\d+) new cards$/, '새 카드 $1장'],
  [/^(\d+) of (\d+) cards learned$/, '$2장 중 $1장 익힘'],
  [/^Study (\d+) cards$/, '카드 $1장 공부하기'],
  [/^Card (\d+) of (\d+)$/, '$2장 중 $1번째'],
  [/^(\d+) got it$/, '$1장 맞힘'],
  [/^(\d+) to go again\. They'll come back soon\.$/, '$1장은 다시 봐요. 곧 다시 나와요.'],
  [/^(\d+) past exams? kept in your records\.$/, '지난 시험 $1개는 기록으로 남아 있어요.'],
  [/^(Practical|Theory|Assignment|Exam), (.+?)(?: · (\d+) of (\d+) dish(?:es)? ready)?$/, (t, d, r, n) => `${t}, ${d}${n ? ` · ${n}개 중 ${r}개 준비됨` : ''}`],
  [/^(\d+) of (\d+) dish(?:es)? ready \(practised (\d+)× with a last rating of 3\+\)$/, '$2개 중 $1개 준비됨 ($3회 이상 연습하고 마지막 평점 3점 이상)'],
  [/^(\d+) of (\d+) practices(?:, last rated (\d)\/5)?$/, (c, t, r) => `${t}회 중 ${c}회 연습${r ? `, 마지막 평점 ${r}/5` : ''}`],

  // Ingredients and yield
  [/^Yield ([\d.]+%), in (\d+) recipes?$/, '수율 $1, 레시피 $2개에 사용'],
  [/^Price history: (.+)$/, '가격 기록: $1'],
  [/^Last yield test (.+): (\S+)\.$/, '마지막 수율 테스트 $1: $2.'],
  [/^Recipes using (.+)$/, '$1을(를) 쓰는 레시피'],
  [/^Each usable (\S+) really costs$/, '사용 가능한 $1당 실제 원가는'],
  [/^, not (\S+)\.$/, '~ (구매가 $1).'],
  [/^([\d.]+ \S+) at (\S+)$/, '$1 ($2)'],
  [/^Use (\S+) for (.+)$/, '$2에 $1 적용'],
  [/^Saved\. (.+) now uses (\S+) yield in every recipe\.$/, '저장했어요. 이제 모든 레시피에서 $1의 수율은 $2예요.'],
  [/^Week of (.+)$/, '$1 주'],
  [/^Delete "(.+)"\? Its past records go too\.$/, '"$1"을(를) 삭제할까요? 지난 기록도 함께 지워져요.'],

  // Log, temperatures, settings
  [/^(\d\d:\d\d) · (.+)$/, '$1 · $2'],
  [/^Action: (.+)$/, '조치: $1'],
  [/^(.+)\. Record a corrective action\.$/, '$1. 시정 조치를 기록하세요.'],
  [/^Must be (.+)$/, '$1이어야 해요'],
  [/^(\d+) check\(s\) still open\. Finish the cooling readings\.$/, '마치지 않은 체크 $1개. 냉각 온도를 마저 기록하세요.'],
  [/^Last synced (.+)$/, '마지막 동기화 $1'],
  [/^· Using ([\d.]+) MB$/, '· $1 MB 사용 중'],
  [/^Could not send: (.+)$/, '보내지 못했어요: $1'],
  [/^Import failed: (.+)$/, '가져오기 실패: $1'],
  [/^Import failed \((\d+)\)\.$/, '가져오기 실패 ($1).'],
  [/^The site answered (\d+)\. Check the link opens in your browser\.$/, '사이트가 $1 오류를 보냈어요. 브라우저에서 링크가 열리는지 확인하세요.'],
  [/^(.+?) → (.+)$/, '$1 → $2'], // nested costing problems: "Sauce → Price missing: Basil"
  [/^Comes with its sub-recipe: (.+)$/, '서브 레시피도 함께 와요: $1'],
  [/^Comes with its (\d+) sub-recipes: (.+)$/, '서브 레시피 $1개도 함께 와요: $2'],
  [/^You already have a recipe called (.+)\. Saving adds a second one\.$/, '이미 "$1" 레시피가 있어요. 저장하면 하나 더 생겨요.'],
  [/^Read (\d+) ingredients and (\d+) steps\. Check them, then Save\.$/, '재료 $1개, 단계 $2개를 읽었어요. 확인하고 저장하세요.'],
  [/^That's (\d+) photos today\. Try again tomorrow, or paste the text instead\.$/, '오늘은 사진 $1장을 다 썼어요. 내일 다시 하거나 글을 붙여넣으세요.'],
  [/^Couldn’t read the photo \((.+)\)\.(?: Try again\.)?$/, '사진을 읽지 못했어요 ($1). 다시 해 보세요.'],
  [/^(\d+) without a price\. Recipes using them show an incomplete cost\.$/, '가격 없는 재료 $1개. 이 재료를 쓰는 레시피는 원가가 미완성으로 나와요.'],
  [/^in (\d+) recipes?$/, '레시피 $1개에 사용'],
  [/^([\d.]+) hours in the kitchen$/, '주방에서 $1시간'],
  [/^Show all (\d+) recipes$/, '레시피 $1개 모두 보기'],
  [/^Portions of (.+)$/, '$1 인분'],
  [/^Rating for (.+)$/, '$1 평점'],
  [/^Class service\. (.+)$/, '수업 서비스. $1'],
  [/^(.+) °C or (?:below|colder)$/, '$1 °C 이하'],
  [/^(.+) °C or above$/, '$1 °C 이상'],
  [/^(\d+) °C centre$/, '중심 $1 °C'],
  [/^within (\d+) h$/, '$1시간 안에'],
  [/^within the next (\d+) h$/, '이후 $1시간 안에'],
  [/^under (\d+) h$/, '$1시간 미만'],
  [/^(\d+) to (\d+) h$/, '$1~$2시간'],
  [/^over (\d+) h$/, '$1시간 초과'],
  [/^(\d+) to (\d+)( °C| ml)?$/, (a, b, u) => `${a}~${b}${u}`],
  [/^(\d+) of (\d+) characters$/, '$2자 중 $1자'],
  [/^Password should be at least (\d+) characters\.?$/, '비밀번호는 $1자 이상이어야 해요.'],
  // Work flow plan
  [/^(\d+) ingredients · (\d+) steps$/, '재료 $1개 · 단계 $2개'],
  [/^Runs (\d+) min past 2:00 pm\. Check the long steps\.$/, '오후 2시를 $1분 넘겨요. 오래 걸리는 단계를 확인하세요.'],
  [/^No ingredients found for (.+)\.$/, n => `${n}에서 재료를 못 찾았어요.`],
  [/^(\d+) ingredients on the list\. Lunch at 12:00, plating after set up\.$/, '재료 목록 $1개. 12시 점심, 플레이팅은 셋업 뒤에 해요.'],
];
