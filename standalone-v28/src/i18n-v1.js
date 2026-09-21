(() => {
  'use strict';

  const STORAGE_KEY = 'max-tour-locale-v1';
  const host = String(location.hostname || '').toLowerCase();
  if (host === 'max-tour-demo.viiversion.com' || host.includes('max-tour-demo')) return;

  const locale = localStorage.getItem(STORAGE_KEY) === 'vi' ? 'vi' : 'ru';
  document.documentElement.lang = locale;

  const VI_TEXT = {
    'Главная':'Trang chủ','Каталог':'Tour','Мои поездки':'Chuyến đi','ИИ-Помощник':'Trợ lý AI',
    'Ваш лучший отдых':'Kỳ nghỉ tuyệt vời nhất','во Вьетнаме':'tại Việt Nam',
    'Ваш лучший отдых во Вьетнаме':'Kỳ nghỉ tuyệt vời nhất tại Việt Nam',
    'Более 150 экскурсий по всему Вьетнаму, Fast Track в аэропортах, трансферы, индивидуальные программы и авторские путешествия по Юго-Восточной Азии.':'Hơn 150 tour khắp Việt Nam, Fast Track tại sân bay, xe đưa đón, chương trình riêng và hành trình đặc biệt khắp Đông Nam Á.',
    'Выбрать тур':'Chọn tour','Быстрый':'Chọn nhanh','выбор':'lựa chọn','по направлениям':'theo điểm đến',
    'Быстрый выбор':'Chọn nhanh','Быстрый выбор по направлениям':'Chọn nhanh theo điểm đến',
    'Популярные экскурсии':'Tour phổ biến','Все':'Tất cả','Подробнее':'Chi tiết','Подробнее об экскурсии':'Chi tiết tour',
    'Нячанг':'Nha Trang','Дананг':'Đà Nẵng','Фукуок':'Phú Quốc','Ханой':'Hà Nội','Далат':'Đà Lạt','Фуйен':'Phú Yên',
    'Муйне/Фантьет':'Mũi Né/Phan Thiết','Премиум':'Cao cấp',
    'Далат, Фуйен, обзорные и морские маршруты':'Đà Lạt, Phú Yên, city tour và tour biển',
    'Ба На Хилл, Золотой мост, Хойан и Мраморные горы':'Bà Nà Hills, Cầu Vàng, Hội An và Ngũ Hành Sơn',
    'Острова, канатная дорога, VinWonders и семейные программы':'Các đảo, cáp treo, VinWonders và chương trình gia đình',
    'Халонг, Сапа, Ниньбинь и туры по северу':'Hạ Long, Sa Pa, Ninh Bình và tour miền Bắc',
    'Фильтры':'Bộ lọc','Фильтры каталога':'Bộ lọc tour','Свернуть фильтры':'Thu gọn bộ lọc','Развернуть фильтры':'Mở rộng bộ lọc',
    'Город':'Thành phố','Все города':'Tất cả thành phố','Длительность':'Thời lượng','Тип отдыха':'Loại hình',
    'Бюджет, $':'Ngân sách, $','Бюджет':'Ngân sách','Бюджет от':'Ngân sách từ','Бюджет до':'Ngân sách đến',
    'от':'từ','до':'đến','С детьми':'Có trẻ em','Показывать только семейные экскурсии':'Chỉ hiển thị tour phù hợp gia đình',
    'Сбросить':'Đặt lại','Поиск по экскурсиям':'Tìm tour','Поиск: Далат, море, Ханой...':'Tìm: Đà Lạt, biển, Hà Nội...',
    'По выбранному фильтру пока нет загруженных экскурсий. Измените параметры или сбросьте фильтр.':'Chưa có tour phù hợp với bộ lọc. Hãy đổi điều kiện hoặc đặt lại bộ lọc.',
    'Морские':'Biển & đảo','Природа и горы':'Thiên nhiên & núi','Культура':'Văn hóa','Fast Track + трансфер':'Fast Track + đưa đón','Другое':'Khác',
    'Маршрут':'Lịch trình','Включено':'Bao gồm','Что взять':'Nên mang theo','Собирающиеся выезды':'Lịch khởi hành ghép đoàn',
    'На этот тур пока нет собирающихся групп.':'Hiện chưa có lịch ghép đoàn cho tour này.','Присоединиться':'Tham gia','Создать свою группу':'Tạo nhóm riêng',
    'Групповой':'Ghép đoàn','Индивидуальный':'Riêng tư','Индивидуально':'Riêng tư','Группа':'Nhóm',
    'Забронировать':'Đặt tour','Оформление поездки':'Đặt chuyến đi','Назад':'Quay lại',
    'Взрослые':'Người lớn','Дети':'Trẻ em','Малыши':'Em bé','Участники поездки':'Người tham gia',
    'Фамилия Имя':'Họ và tên','Имя':'Tên','Телефон':'Điện thoại','Дата рождения':'Ngày sinh','Дата':'Ngày',
    'Отель':'Khách sạn','Отель / район':'Khách sạn / khu vực','Способ оплаты':'Phương thức thanh toán',
    'Оплата':'Thanh toán','Перейти к оплате':'Tiến hành thanh toán','Оплата 100%':'Thanh toán 100%','Оплата выполнена':'Đã thanh toán',
    'Состав группы':'Thành phần đoàn','Стоимость':'Chi phí','Стоимость поездки':'Chi phí chuyến đi','к оплате гиду':'trả cho hướng dẫn viên',
    'дата на выбор':'chọn ngày','дата не указана':'chưa chọn ngày','дата не определена':'chưa xác định ngày',
    'Сохранить':'Lưu','Сохранить подбор':'Lưu lựa chọn','Выбрать из сохранённых':'Chọn từ danh sách đã lưu',
    'Забронированные':'Đã đặt','Поездка завершена':'Chuyến đi đã hoàn thành','Поездка отменена':'Chuyến đi đã hủy','Поездка перенесена':'Chuyến đi đã đổi lịch',
    'Перенести поездку':'Đổi lịch chuyến đi','Отменить':'Hủy','Отмена':'Hủy','Перенос':'Đổi lịch','Возврат':'Hoàn tiền',
    'Правила поездки':'Điều kiện chuyến đi','Правила оплаты, переноса и отмены':'Quy định thanh toán, đổi lịch và hủy',
    'Спросить помощника':'Hỏi trợ lý','Напишите сообщение...':'Nhập tin nhắn...',
    'Напишите: хочу море, дети 7 и 10 лет...':'Ví dụ: tôi muốn đi biển, có trẻ 7 và 10 tuổi...',
    'Задавайте вопрос — я помогу с поездкой.':'Hãy đặt câu hỏi — tôi sẽ giúp bạn lên chuyến đi.',
    'Задавайте вопрос — я помогу подобрать экскурсию и сразу перейти к бронированию.':'Hãy đặt câu hỏi — tôi sẽ giúp chọn tour và chuyển ngay đến bước đặt tour.',
    'Я AI-консультант, задайте мне любые вопросы, я подскажу вам с поездкой и помогу разобраться во всем.':'Tôi là trợ lý AI. Hãy hỏi bất cứ điều gì về chuyến đi — tôi sẽ giúp bạn chọn phương án phù hợp.',
    'Расскажите, кто едет, город, дату и желаемый темп. Я предложу 2–3 экскурсии MaxTour и объясню разницу.':'Hãy cho biết ai đi cùng, thành phố, ngày dự kiến và nhịp độ mong muốn. Tôi sẽ đề xuất 2–3 tour MaxTour và giải thích sự khác nhau.',
    'Советую эти поездки':'Gợi ý cho bạn','Подходящие экскурсии':'Tour phù hợp',
    'Что вам интереснее: море и острова, природа, город или что-то премиальное?':'Bạn thích biển & đảo, thiên nhiên, thành phố hay trải nghiệm cao cấp?',
    'Сколько человек едет?':'Có bao nhiêu người đi?','На какую дату планируете поездку?':'Bạn dự định đi ngày nào?',
    'Покажу подходящие варианты.':'Tôi sẽ hiển thị các lựa chọn phù hợp.','Выберите вариант ниже — я сразу помогу перейти к бронированию.':'Chọn một phương án bên dưới — tôi sẽ giúp bạn chuyển ngay đến bước đặt tour.',
    'Не нашёл точного совпадения. Откройте каталог и уточните город, состав группы или желаемый формат отдыха.':'Chưa tìm thấy phương án khớp hoàn toàn. Hãy mở danh sách tour và cho biết thành phố, số người hoặc hình thức mong muốn.',
    'цена уточняется':'giá đang cập nhật','стоимость уточняется после выбора даты':'giá được xác nhận sau khi chọn ngày',
    'индивидуальный / групповой':'riêng tư / ghép đoàn','лёгкий':'nhẹ','средний':'vừa','активный':'năng động',
    'семья':'gia đình','пара':'cặp đôi','компания':'nhóm bạn','дети':'trẻ em','старшие туристы':'khách lớn tuổi',
    'город':'thành phố','культура':'văn hóa','природа':'thiên nhiên','горы':'núi','фото':'chụp ảnh','море':'biển',
    'острова':'đảo','канатная дорога':'cáp treo','снорклинг':'lặn ngắm san hô','животные':'động vật','парк':'công viên',
    'аттракционы':'trò chơi','дюны':'đồi cát','рассвет':'bình minh','круиз':'du thuyền','лодка':'thuyền',
    'рисовые террасы':'ruộng bậc thang','золотой мост':'Cầu Vàng','мосты':'cầu','вечер':'buổi tối','ужин':'bữa tối',
    'комфорт':'thoải mái','без очереди':'không xếp hàng','трансфер':'đưa đón','аэропорт':'sân bay',
    'хит':'nổi bật','дикий пляж':'bãi biển hoang sơ','с отелем':'có khách sạn','до $50':'dưới $50',
    'пещера муа':'Hang Múa','сапа':'Sa Pa','халонг':'Hạ Long',
    'собирается':'đang nhận khách','почти собрана':'gần đủ','лист ожидания':'danh sách chờ','отменена':'đã hủy',
    'без удержания':'không mất phí','по правилам':'theo quy định','мест':'chỗ',
    'до 2 лет бесплатно':'miễn phí dưới 2 tuổi','до 100 см бесплатно':'miễn phí dưới 100 cm','30% или 100%':'30% hoặc 100%',
    '—':'—','по договорённости':'theo thỏa thuận','по запросу':'theo yêu cầu',
    'Данные рейса':'Thông tin chuyến bay','Название отеля':'Tên khách sạn','Паспорт':'Hộ chiếu',
    'Готово':'Xong','Отправить':'Gửi','Показать':'Hiển thị','Новая дата':'Ngày mới','Не отменять':'Không hủy',
    'Подтвердить отмену':'Xác nhận hủy','Подтвердить перенос':'Xác nhận đổi lịch',
    'Отмена недоступна':'Không thể hủy','Перенос недоступен':'Không thể đổi lịch',
    'К возврату':'Số tiền hoàn','Расчёт при открытии':'Tính khi mở','Требует подтверждения менеджером перед оплатой':'Cần nhân viên xác nhận trước khi thanh toán',
    'Открыть каталог':'Mở danh sách tour','Открыть Далат':'Mở tour Đà Lạt'
  };

  const CITY = {
    'Нячанг':'Nha Trang','Дананг':'Đà Nẵng','Фукуок':'Phú Quốc','Ханой':'Hà Nội','Далат':'Đà Lạt',
    'Фуйен':'Phú Yên','Муйне/Фантьет':'Mũi Né/Phan Thiết','Муйне':'Mũi Né','Аэропорт':'Sân bay',
    'Ба На Хилл · Хойан':'Bà Nà Hills · Hội An','Южные острова':'Các đảo phía Nam','Север острова':'Bắc đảo',
    'Ханой · Халонг':'Hà Nội · Hạ Long','Сапа · Фансипан':'Sa Pa · Fansipan','Ниньбинь':'Ninh Bình'
  };
  const SIMPLE = {
    '1 день':'1 ngày','полдня':'nửa ngày','вечер':'buổi tối','2 дня':'2 ngày','2 дня / 1 ночь':'2 ngày / 1 đêm',
    '3 дня / 2 ночи':'3 ngày / 2 đêm','прилёт':'đón sân bay','по времени рейса':'theo giờ chuyến bay',
    'премиум':'cao cấp','природа':'thiên nhiên','семья':'gia đình','горы':'núi','фото':'chụp ảnh','хит':'nổi bật',
    'животные':'động vật','культура':'văn hóa','море':'biển','дикий пляж':'bãi biển hoang sơ','город':'thành phố',
    'легкая':'nhẹ','вечер':'buổi tối','ужин':'bữa tối','2 дня':'2 ngày','с отелем':'có khách sạn',
    'аэропорт':'sân bay','трансфер':'đưa đón','комфорт':'thoải mái','без очереди':'không xếp hàng',
    'золотой мост':'Cầu Vàng','мосты':'cầu','острова':'đảo','канатная дорога':'cáp treo','снорклинг':'lặn ngắm san hô',
    'парк':'công viên','дети':'trẻ em','аттракционы':'trò chơi','круиз':'du thuyền','халонг':'Hạ Long',
    'сапа':'Sa Pa','рисовые террасы':'ruộng bậc thang','лодка':'thuyền','пещера муа':'Hang Múa','дюны':'đồi cát',
    'рассвет':'bình minh','лёгкий':'nhẹ','средний':'vừa','активный':'năng động','пара':'cặp đôi','компания':'nhóm bạn',
    'старшие туристы':'khách lớn tuổi','solo':'đi một mình','индивидуальный / групповой':'riêng tư / ghép đoàn',
    'Морские':'Biển & đảo','Природа и горы':'Thiên nhiên & núi','Культура':'Văn hóa','Премиум':'Cao cấp',
    'Fast Track + трансфер':'Fast Track + đưa đón','30% или 100%':'30% hoặc 100%','до 2 лет бесплатно':'miễn phí dưới 2 tuổi',
    'до 100 см бесплатно':'miễn phí dưới 100 cm','собирается':'đang nhận khách','почти собрана':'gần đủ','лист ожидания':'danh sách chờ'
  };

  const VI_TOURS = {
    'dalat-premium': {
      title:'Đà Lạt “Premium”',
      groupNotes:['Đoàn 14–20 khách','Bao gồm bữa trưa, vé tham quan và cáp treo','Hướng dẫn viên tiếng Nga và xe đón từ khách sạn'],
      individualNotes:['Chọn ngày ngay khi đặt','Có thể điều chỉnh lịch trình thoải mái hơn','Có thể thanh toán phần còn lại cho hướng dẫn viên bằng VND'],
      route:[
        ['Đồn điền cà phê','Khám phá văn hóa cà phê Việt Nam và quán cà phê lớn nhất khu vực.'],
        ['Đèo núi','Cung đường uốn lượn với tầm nhìn ra núi, mây và rừng.'],
        ['Làng Đất Sét','Công viên sáng tạo với các tác phẩm nghệ thuật và những gương mặt đá nổi tiếng dưới nước.'],
        ['Crazy House','Một trong những công trình kiến trúc độc đáo nhất Đà Lạt.'],
        ['Chùa Linh Phước','Ngôi chùa Phật giáo với nghệ thuật khảm kính và gốm sứ.'],
        ['Thác Datanla','Rừng thông, thiên nhiên núi rừng và xe trượt điện có phụ phí tại chỗ.'],
        ['Cáp treo','Ngắm toàn cảnh Đà Lạt, hồ và rừng thông từ trên cao.']
      ],
      included:['Bữa trưa ngon','Toàn bộ vé vào cửa và cáp treo','Hướng dẫn viên tiếng Nga chuyên nghiệp','Xe minibus thoải mái','Mỗi khách một chai nước'],
      take:['Trang phục che vai và đầu gối khi vào chùa','Đặt bữa sáng mang đi từ tối hôm trước','Áo khoác vì Đà Lạt mát hơn','Áo mưa','Giày thoải mái','VND cho quà lưu niệm và chi phí nhỏ']
    },
    'dalat-vip': {
      title:'Đà Lạt “VIP”',
      groupNotes:['Đoàn 14–20 khách','Bao gồm bữa trưa, vé, nước và hướng dẫn viên tiếng Nga','Lịch trình phong phú nhưng không quá gấp'],
      individualNotes:['Nhịp độ riêng','Có thể ở lâu hơn tại các điểm chính','Phù hợp cho gia đình và nhóm bạn'],
      route:[
        ['Đồn điền cà phê','Khám phá văn hóa cà phê và quán cà phê lớn của khu vực.'],
        ['Làng Hobbit','Không gian cổ tích với những ngôi nhà đẹp để chụp ảnh.'],
        ['Đèo núi','Cung đường đẹp xuyên qua núi và rừng.'],
        ['Làng Đất Sét','Công viên nghệ thuật với các gương mặt đá dưới nước.'],
        ['Crazy House','Kiến trúc độc đáo và bầu không khí sáng tạo của Đà Lạt.'],
        ['Chùa Linh Phước','Nghệ thuật khảm kính và gốm sứ.'],
        ['Thác Datanla','Thác núi và xe trượt có phụ phí.'],
        ['Nông trại động vật','Hổ, sư tử, capybara, voi và đà điểu; các hoạt động trả phí tại chỗ.']
      ],
      included:['Bữa trưa ngon','Toàn bộ vé vào cửa','Hướng dẫn viên tiếng Nga','Xe minibus thoải mái','Nhóm quy mô thoải mái','Nước uống'],
      take:['Mũ và kem chống nắng','Bữa sáng mang đi từ tối hôm trước','Giày thoải mái','Đồ bơi/đồ dự phòng tùy thời tiết','Tinh thần vui vẻ','VND cho chi phí nhỏ']
    },
    'fuyen': {
      title:'Tỉnh Phú Yên',
      groupNotes:['Đoàn 14–20 khách','Bao gồm bữa trưa, vé, xe đưa đón và nước','Nhiều điểm thiên nhiên và chụp ảnh'],
      individualNotes:['Lịch trình riêng cho nhóm của bạn','Chủ động nhịp độ trong ngày','Phù hợp chụp ảnh và dừng nghỉ thư thả'],
      route:[
        ['Bãi biển hoang sơ','Tắm biển và tận hưởng thiên nhiên nguyên sơ.'],
        ['Tuy Hòa và tháp Chăm','Di tích kiến trúc và văn hóa Chăm cổ.'],
        ['Tháp Nghinh Phong','Công trình trắng hiện đại, biểu tượng mới của tỉnh.'],
        ['Hải đăng mũi Điện','Một trong những điểm cực Đông nổi tiếng của Việt Nam.'],
        ['Chùa Trầm','Không gian tâm linh và những câu chuyện địa phương.'],
        ['Bữa trưa tại nhà hàng','Món ăn truyền thống và các món canh.'],
        ['Chùa Thanh Lương','Điểm dừng yên bình cuối hành trình.'],
        ['Gành Đá Đĩa','Các khối đá bazan độc đáo bên biển.'],
        ['Nhà thờ Mằng Lăng','Một trong những nhà thờ cổ nổi tiếng của Việt Nam.']
      ],
      included:['Bữa trưa ngon','Toàn bộ vé vào cửa','Hướng dẫn viên tiếng Nga','Xe minibus thoải mái','Nhóm quy mô thoải mái','Nước uống'],
      take:['Mũ và kem chống nắng','Bữa sáng mang đi từ tối hôm trước','Giày thoải mái và ba lô','Đồ bơi, khăn tắm','Tinh thần vui vẻ','VND cho quà lưu niệm']
    },
    'nhatrang-day': {
      title:'City tour Nha Trang ban ngày',
      groupNotes:['Chương trình ngắn gọn, thuận tiện','Bao gồm bữa trưa, vé, xe đưa đón và nước','Phù hợp cho lần đầu khám phá Nha Trang'],
      individualNotes:['Phù hợp cho gia đình hoặc nhóm nhỏ','Có thể đi với nhịp độ thoải mái','Không phải di chuyển xa khỏi thành phố'],
      route:[
        ['Chùa Long Sơn và tượng Phật Trắng','Ngôi chùa Phật giáo và biểu tượng nổi tiếng của Nha Trang.'],
        ['Nhà thờ Núi Nha Trang','Kiến trúc Gothic Pháp đầu thế kỷ XX.'],
        ['Hòn Chồng','Các khối đá ven biển và tầm nhìn đẹp ra bờ biển.'],
        ['Chùa Trúc Lâm Phụng','Điểm ngắm toàn cảnh trên núi Chín Khúc.'],
        ['Tháp Bà Po Nagar','Quần thể đền Chăm lịch sử.'],
        ['Bãi biển phía Bắc Nha Trang','Đi dạo dọc một đoạn bờ biển đẹp.'],
        ['Bữa trưa tại nhà hàng','Ẩm thực Việt Nam và nghỉ ngơi sau chuyến tham quan.']
      ],
      included:['Bữa trưa','Vé tham quan','Hướng dẫn viên tiếng Nga','Xe minibus thoải mái','Nhóm quy mô thoải mái','Nước uống'],
      take:['Trang phục kín đáo khi vào chùa','Mũ và kem chống nắng','Tinh thần vui vẻ','VND cho quà lưu niệm']
    },
    'nhatrang-night': {
      title:'City tour Nha Trang buổi tối',
      groupNotes:['Buffet hải sản và chương trình biểu diễn truyền thống','Bao gồm toàn bộ vé tham quan','Khung giờ buổi tối thuận tiện'],
      individualNotes:['Lịch trình buổi tối riêng','Thuận tiện cho gia đình và cặp đôi','Có thể tham quan chùa và điểm ngắm cảnh thong thả hơn'],
      route:[
        ['Chùa Đa Bảo','Ngôi chùa trên đỉnh đồi với tầm nhìn toàn cảnh.'],
        ['Hòn Chồng','Các khối đá ven biển.'],
        ['Nhà thờ Núi Nha Trang','Nhà thờ Gothic đầu thế kỷ XX.'],
        ['Nhà hát Đó','Kiến trúc lấy cảm hứng từ chiếc đó truyền thống Việt Nam.'],
        ['Tháp Bà Po Nagar','Quần thể đền tháp lịch sử.'],
        ['Chùa Long Sơn và tượng Phật Trắng','Quần thể Phật giáo nổi tiếng.'],
        ['Nhà hàng Làng Ngon','Bữa tối hải sản và chương trình biểu diễn truyền thống.']
      ],
      included:['Buffet hải sản và chương trình biểu diễn','Toàn bộ vé vào cửa','Hướng dẫn viên tiếng Nga','Xe đưa đón','Nhóm quy mô thoải mái','Nước uống'],
      take:['Trang phục kín đáo khi vào chùa','Mũ và kem chống nắng','Tinh thần vui vẻ','VND cho chi phí nhỏ']
    },
    'dalat-2days': {
      title:'Đà Lạt 2 ngày',
      groupNotes:['Hai chương trình: Tiêu chuẩn và + Cầu kính','Bao gồm bữa sáng và hai bữa trưa','Lưu trú tùy theo loại phòng'],
      individualNotes:['Chương trình riêng 2 ngày','Phù hợp nếu muốn khám phá Đà Lạt không vội','Giá cuối cùng có thể phụ thuộc loại phòng'],
      route:[
        ['Ngày 1: đồn điền cà phê','Văn hóa cà phê và cung đường đèo núi.'],
        ['Làng Đất Sét và Crazy House','Hai điểm sáng tạo độc đáo của Đà Lạt.'],
        ['Chùa Linh Phước và Đại Phật','Chùa, cảnh quan và kiến trúc.'],
        ['Thác Datanla','Thiên nhiên núi rừng và các hoạt động tại chỗ.'],
        ['Nhận phòng khách sạn','Trung tâm Đà Lạt và thời gian tự do buổi tối.'],
        ['Ngày 2: nông trại, thác và ga cổ','Động vật, thác Pongour, cáp treo và ga Đà Lạt.']
      ],
      included:['Bữa sáng và hai bữa trưa','Toàn bộ vé vào cửa','Hướng dẫn viên tiếng Nga','Xe đưa đón','Lưu trú theo gói đã chọn','Nước uống'],
      take:['Trang phục kín đáo khi vào chùa','Bữa sáng mang đi cho ngày đầu','Áo khoác','Áo mưa','Giày thoải mái','VND cho phụ phí và quà lưu niệm']
    },
    'fast-track': {
      title:'Fast Track + đưa đón',
      groupNotes:['Dịch vụ này sử dụng hình thức riêng tư','Phù hợp khi đến sân bay và di chuyển về khách sạn'],
      individualNotes:['Đón với bảng tên','Làm thủ tục nhập cảnh không phải xếp hàng','Xe riêng về khách sạn tại trung tâm Nha Trang'],
      route:[
        ['Đón tại sân bay','Nhân viên đón tại khu vực làm thủ tục hải quan.'],
        ['Làm thủ tục nhanh','Hỗ trợ qua kiểm soát hộ chiếu.'],
        ['Đưa về khách sạn','Xe riêng thoải mái về khách sạn tại trung tâm Nha Trang.']
      ],
      included:['Đón với bảng tên','Làm thủ tục hộ chiếu không xếp hàng','Xe riêng về khách sạn'],
      take:['Hộ chiếu','Thông tin chuyến bay','Tên khách sạn']
    },
    'danang-ba-na-hoian': {
      title:'Bà Nà Hills, Cầu Vàng và Hội An',
      groupNotes:['Đoàn 14–20 khách','Cáp treo, công viên và Hội An buổi tối','Phù hợp cho lần đầu khám phá miền Trung Việt Nam'],
      individualNotes:['Lịch trình theo nhịp độ của bạn','Có thể ở lâu hơn tại Cầu Vàng hoặc Hội An','Thoải mái cho gia đình và nhóm bạn'],
      route:[
        ['Bà Nà Hills','Đi cáp treo lên khu du lịch trên núi.'],
        ['Cầu Vàng','Dạo trên cây cầu nổi tiếng với đôi bàn tay đá.'],
        ['Làng Pháp','Điểm chụp ảnh, kiến trúc và thời gian tự do.'],
        ['Ngũ Hành Sơn','Hang động, chùa và điểm ngắm cảnh.'],
        ['Hội An buổi tối','Phố đèn lồng, dạo bộ và những con phố đầy không khí.']
      ],
      included:['Xe đưa đón theo chương trình','Vé tham quan theo chương trình','Hướng dẫn tiếng Nga','Nước uống','Hỗ trợ mua vé'],
      take:['Giày thoải mái','Mũ và kem chống nắng','Áo khoác cho Bà Nà Hills','VND cho chi tiêu cá nhân','Sạc điện thoại']
    },
    'danang-city-sontra': {
      title:'Đà Nẵng: Sơn Trà, Ngũ Hành Sơn và các cây cầu',
      groupNotes:['Chương trình buổi tối ngắn','Các điểm chính của Đà Nẵng','Phù hợp sau một ngày ở biển'],
      individualNotes:['Giờ khởi hành linh hoạt','Có thể thêm nhà hàng hoặc điểm chụp ảnh','Phù hợp để khám phá thành phố nhẹ nhàng'],
      route:[
        ['Chùa Linh Ứng','Tầm nhìn đẹp ra biển và thành phố.'],
        ['Ngũ Hành Sơn','Hang động, bậc thang và các khu chùa.'],
        ['Cầu Rồng','Biểu tượng Đà Nẵng và ánh đèn buổi tối.'],
        ['Bờ sông Hàn','Đi dạo ngắn và chụp ảnh.']
      ],
      included:['Xe đưa đón','Hướng dẫn/đồng hành','Nước uống','Hỗ trợ mua vé'],
      take:['Giày thoải mái','Trang phục che vai khi vào chùa','Nước uống','Điện thoại để chụp ảnh']
    },
    'phuquoc-4-islands': {
      title:'Phú Quốc: 4 đảo và cáp treo',
      groupNotes:['Đoàn theo lịch cố định','Đảo, bãi biển và cáp treo','Có thể thêm chuyến đi biển'],
      individualNotes:['Ca nô/xe riêng theo yêu cầu','Có thể điều chỉnh nhịp độ và thời gian ở bãi biển','Thuận tiện cho gia đình có trẻ em'],
      route:[
        ['Các đảo phía Nam','Đi biển giữa những hòn đảo đẹp.'],
        ['Dừng tại bãi biển','Tắm biển, chụp ảnh và nghỉ ngơi.'],
        ['Lặn ngắm san hô','Các điểm đơn giản để khám phá thế giới dưới nước.'],
        ['Cáp treo Hòn Thơm','Ngắm biển và đảo từ trên cao.']
      ],
      included:['Xe đón từ khách sạn trong khu vực','Chuyến đi biển','Nước uống','Hỗ trợ mua vé','Hỗ trợ trong chương trình'],
      take:['Đồ bơi và khăn','Kem chống nắng','Mũ','Quần áo khô','VND cho phụ phí']
    },
    'phuquoc-vinwonders-safari': {
      title:'VinWonders và Safari Phú Quốc',
      groupNotes:['Vé và xe đưa đón tùy gói đã chọn','Chương trình cả ngày','Thuận tiện cho gia đình'],
      individualNotes:['Xe đưa đón riêng','Giờ về linh hoạt','Có thể chọn chỉ công viên hoặc công viên + safari'],
      route:[
        ['VinWonders','Các khu chủ đề, thủy cung và trò chơi.'],
        ['Safari','Công viên động vật và hoạt động cho gia đình.'],
        ['Grand World','Dạo buổi tối ở phía Bắc đảo nếu muốn.']
      ],
      included:['Xe đưa đón','Hỗ trợ mua vé','Hỗ trợ theo chương trình','Nước uống'],
      take:['Giày thoải mái','Mũ cho trẻ em','Đồ bơi cho khu công viên nước','Giấy tờ/bản sao giấy tờ của trẻ']
    },
    'hanoi-halong-2d': {
      title:'Hà Nội và Vịnh Hạ Long',
      groupNotes:['Đoàn theo yêu cầu','Du thuyền và chương trình tham quan','Giá phụ thuộc ngày đi và loại cabin'],
      individualNotes:['Chương trình riêng gồm chuyến bay/xe đưa đón','Du thuyền Diamond Era Cruise 5★ theo chương trình','Giá hiện tại phụ thuộc mùa và vé'],
      route:[
        ['Hà Nội','Phố cổ, chùa và những điểm chính của thành phố.'],
        ['Vịnh Hạ Long','Di chuyển đến bến và lên du thuyền.'],
        ['Du thuyền','Bữa trưa, hang động, kayak hoặc thuyền, ngắm hoàng hôn trên tàu.'],
        ['Trở về','Xe đưa đón và kết thúc chương trình.']
      ],
      included:['Ăn uống theo chương trình','Vé máy bay/xe đưa đón theo chương trình','Vé tham quan','Hướng dẫn viên tiếng Nga tại Hà Nội','Du thuyền 5★'],
      take:['Hộ chiếu','Giày thoải mái','VND cho chi phí nhỏ','Sạc điện thoại','Áo khoác nhẹ buổi tối']
    },
    'hanoi-sapa-3d': {
      title:'Hà Nội và Sa Pa',
      groupNotes:['Lịch ghép đoàn theo yêu cầu','Núi, Fansipan và các bản làng Sa Pa','Giá phụ thuộc mùa'],
      individualNotes:['Lịch trình Hà Nội, Sa Pa và Fansipan','Phù hợp nếu muốn khám phá núi phía Bắc','Giá hiện tại phụ thuộc vé và mùa'],
      route:[
        ['Hà Nội','Chương trình tham quan thủ đô.'],
        ['Sa Pa','Di chuyển đến vùng núi và dạo buổi tối.'],
        ['Bản Cát Cát','Khám phá đời sống và truyền thống địa phương.'],
        ['Fansipan','Cáp treo và nóc nhà Đông Dương.'],
        ['Thác Bạc','Điểm thiên nhiên cuối hành trình.']
      ],
      included:['Xe đưa đón theo chương trình','Lưu trú','Ăn uống theo chương trình','Vé theo chương trình','Hướng dẫn/đồng hành'],
      take:['Hộ chiếu','Áo khoác hoặc áo gió','Giày thoải mái','VND','Bộ thuốc cá nhân']
    },
    'hanoi-ninhbinh': {
      title:'Ninh Bình: Tràng An và Hang Múa',
      groupNotes:['Khởi hành ghép đoàn từ Hà Nội','Đi thuyền và điểm ngắm cảnh','Một ngày nhiều trải nghiệm'],
      individualNotes:['Xe riêng từ Hà Nội','Có thể chọn nhịp độ thư thả hơn','Rất phù hợp cho chụp ảnh và thiên nhiên'],
      route:[
        ['Tràng An','Đi thuyền giữa núi đá, sông và hang động.'],
        ['Nhà hàng ẩm thực địa phương','Bữa trưa và nghỉ ngơi.'],
        ['Hang Múa','Leo lên điểm ngắm cảnh.'],
        ['Đền/chùa và làng quê','Điểm dừng văn hóa tùy thời gian chương trình.']
      ],
      included:['Xe đưa đón','Đi thuyền','Vé tham quan','Bữa trưa','Hỗ trợ trong chương trình'],
      take:['Giày thoải mái','Mũ','Nước uống','VND','Trang phục phù hợp khi vào chùa']
    },
    'muine-dunes-jeep': {
      title:'Mũi Né: đồi cát, làng chài và Suối Tiên',
      groupNotes:['Lịch ghép đoàn ngắm bình minh','Đồi cát trắng và đỏ','Chụp ảnh và đi bộ nhẹ'],
      individualNotes:['Xe jeep/xe riêng','Có thể chọn bình minh hoặc hoàng hôn','Phù hợp cho hành trình chụp ảnh'],
      route:[
        ['Đồi cát trắng','Ngắm bình minh và toàn cảnh.'],
        ['Đồi cát đỏ','Dừng chụp ảnh trên cát màu.'],
        ['Làng chài','Thuyền, cuộc sống địa phương và chợ sáng.'],
        ['Suối Tiên','Đi bộ trong dòng suối nông giữa những sườn đất đỏ.']
      ],
      included:['Xe đưa đón','Jeep/xe theo chương trình','Nước uống','Hỗ trợ trong chương trình'],
      take:['Giày thoải mái','Mũ','Điện thoại/máy ảnh','VND cho chi tiêu cá nhân']
    }
  };

  function tr(value) {
    const raw = String(value == null ? '' : value);
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    if (VI_TEXT[trimmed]) return raw.replace(trimmed, VI_TEXT[trimmed]);
    if (CITY[trimmed]) return raw.replace(trimmed, CITY[trimmed]);
    if (SIMPLE[trimmed]) return raw.replace(trimmed, SIMPLE[trimmed]);
    const simple = mapSimple(trimmed);
    if (simple !== trimmed) return raw.replace(trimmed, simple);
    let m;
    if ((m = trimmed.match(/^(\d+)\s+найдено$/))) return raw.replace(trimmed, m[1] + ' tour');
    if ((m = trimmed.match(/^(\d+)\s+из\s+(\d+)\s+мест$/))) return raw.replace(trimmed, m[1] + '/' + m[2] + ' chỗ');
    if ((m = trimmed.match(/^Групповой от\s+(.+)$/))) return raw.replace(trimmed, 'Ghép đoàn từ ' + m[1]);
    if ((m = trimmed.match(/^Индивидуальный от\s+(.+)$/))) return raw.replace(trimmed, 'Riêng tư từ ' + m[1]);
    if ((m = trimmed.match(/^от\s+(.+)$/))) return raw.replace(trimmed, 'từ ' + m[1]);
    if ((m = trimmed.match(/^(\d{1,2})\s+сен$/))) return raw.replace(trimmed, m[1] + ' Thg 9');
    if (trimmed.includes(' · выезд ')) return raw.replace(trimmed, trimmed.replace(' · выезд ', ' · khởi hành '));
    if (trimmed === 'до 17:00 накануне') return raw.replace(trimmed, 'trước 17:00 ngày hôm trước');
    return raw;
  }

  function translateAttr(el, name) {
    const value = el.getAttribute(name);
    if (!value) return;
    const next = tr(value);
    if (next !== value) el.setAttribute(name, next);
  }

  function translateNode(root) {
    if (locale !== 'vi' || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.parentElement && /^(SCRIPT|STYLE|NOSCRIPT)$/i.test(node.parentElement.tagName)) return;
      if (!/[А-Яа-яЁё]/.test(node.nodeValue || '')) return;
      node.nodeValue = tr(node.nodeValue);
    });
    const scope = root.querySelectorAll ? [root, ...root.querySelectorAll('[placeholder],[aria-label],[title]')] : [root];
    scope.forEach(el => {
      if (!(el instanceof Element)) return;
      translateAttr(el,'placeholder'); translateAttr(el,'aria-label'); translateAttr(el,'title');
    });
  }

  function mapSimple(value) {
    const key = String(value == null ? '' : value);
    if (CITY[key]) return CITY[key];
    if (SIMPLE[key]) return SIMPLE[key];
    if (/^(\d+)\s+сен$/.test(key)) return key.replace(' сен',' Thg 9');
    if (key === '05:00–05:30 → около 20:00') return '05:00–05:30 → khoảng 20:00';
    if (key === '05:00–05:30 → около 18:30') return '05:00–05:30 → khoảng 18:30';
    if (key === '05:00–05:30 → около 18:30 второго дня') return '05:00–05:30 → khoảng 18:30 ngày thứ hai';
    if (key === '08:00 → около 20:30') return '08:00 → khoảng 20:30';
    if (key === '14:00 → около 19:30') return '14:00 → khoảng 19:30';
    if (key === '08:30 → около 17:30') return '08:30 → khoảng 17:30';
    if (key === '09:00 → около 18:00') return '09:00 → khoảng 18:00';
    if (key === '08:00 → около 18:30') return '08:00 → khoảng 18:30';
    if (key === '04:30 → около 09:30') return '04:30 → khoảng 09:30';
    if (key === 'утро 1-го дня → вечер 2-го дня') return 'sáng ngày 1 → tối ngày 2';
    if (key === 'утро 1-го дня → вечер 3-го дня') return 'sáng ngày 1 → tối ngày 3';
    if (key === 'по времени рейса') return 'theo giờ chuyến bay';
    if (key === 'по договорённости') return 'theo thỏa thuận';
    if (key === '30% или 100%') return '30% hoặc 100%';
    if (key === 'до 2 лет бесплатно') return 'miễn phí dưới 2 tuổi';
    if (key === 'до 100 см бесплатно') return 'miễn phí dưới 100 cm';
    if (key === 'Дата выбирается сразу') return 'Chọn ngày ngay khi đặt';
    if (/^(\d+)[–-](\d+)\s+человека\s+—\s+(.+)$/.test(key)) return key.replace('человека','người');
    if (/^(\d+)\s+человек[а]?\s+—\s+(.+)$/.test(key)) return key.replace(/человек[а]?/,'người');
    return key;
  }

  function patchTour(tour) {
    const o = VI_TOURS[tour.id];
    if (!o) return;
    // Keep technical/filter fields in the original Russian values.
    // Only content shown to the tourist is localized, so catalogue filters
    // and booking logic keep using the exact v28 data model.
    if (!tour.__mtRuTitle) tour.__mtRuTitle = tour.title;
    tour.title = o.title || tour.title;
    if (tour.group && o.groupNotes) tour.group.notes = o.groupNotes.slice();
    if (tour.individual) {
      if (o.individualNotes) tour.individual.notes = o.individualNotes.slice();
      tour.individual.tiers = (tour.individual.tiers || []).map(mapSimple);
    }
    if (o.route) tour.route = o.route.map(x => x.slice());
    if (o.included) tour.included = o.included.slice();
    if (o.take) tour.take = o.take.slice();
  }

  function patchTours() {
    if (locale !== 'vi') return;
    try {
      if (typeof TOURS !== 'undefined' && Array.isArray(TOURS)) TOURS.forEach(patchTour);
      if (typeof demoTrips !== 'undefined' && Array.isArray(demoTrips)) {
        demoTrips.forEach(trip => {
          const id = String(trip.tourId || '');
          if (id && VI_TOURS[id]) trip.title = VI_TOURS[id].title;
          else {
            const match = Object.entries(VI_TOURS).find(([tourId]) => {
              try { return typeof TOURS !== 'undefined' && TOURS.find(t => t.id === tourId && t.title === trip.title); } catch (_) { return false; }
            });
            if (match) trip.title = match[1].title;
          }
        });
      }
    } catch (_) {}
  }

  function mapViQuery(value) {
    let q = String(value == null ? '' : value).toLowerCase();
    const aliases = [
      [/nha\s*trang/g,'нячанг'],[/đà\s*lạt|da\s*lat/g,'далат'],[/đà\s*nẵng|da\s*nang/g,'дананг'],
      [/phú\s*quốc|phu\s*quoc/g,'фукуок'],[/phú\s*yên|phu\s*yen|tuy\s*hòa|tuy\s*hoa/g,'фуйен'],
      [/hà\s*nội|ha\s*noi/g,'ханой'],[/hạ\s*long|ha\s*long/g,'халонг'],[/hội\s*an|hoi\s*an/g,'хойан'],
      [/mũi\s*né|mui\s*ne|phan\s*thiết|phan\s*thiet/g,'муйне'],
      [/biển|bãi\s*biển/g,'море'],[/đảo/g,'остров'],[/thiên\s*nhiên/g,'природа'],[/núi/g,'горы'],
      [/thác/g,'водопад'],[/văn\s*hóa/g,'культура'],[/thành\s*phố/g,'город'],[/cao\s*cấp/g,'премиум'],
      [/gia\s*đình/g,'семья'],[/trẻ\s*em/g,'дети'],[/cáp\s*treo/g,'канатная дорога'],[/du\s*thuyền/g,'круиз'],
      [/đồi\s*cát/g,'дюны'],[/cầu\s*vàng/g,'золотой мост']
    ];
    for (const [pattern, ru] of aliases) q = q.replace(pattern, ru);
    return q;
  }

  function installViSearchBridge() {
    if (locale !== 'vi') return;
    try {
      if (typeof filteredTours !== 'function' || filteredTours.__maxTourViBridge) return;
      const original = filteredTours;
      const bridged = function() {
        const originalQuery = state?.filters?.query;
        if (state?.filters) state.filters.query = mapViQuery(originalQuery);
        try { return original(); }
        finally { if (state?.filters) state.filters.query = originalQuery; }
      };
      bridged.__maxTourViBridge = true;
      filteredTours = bridged;
    } catch (_) {}
  }

  function renderSwitcher() {
    let wrap = document.querySelector('.mt-language-switcher');
    if (!wrap) {
      const top = document.querySelector('.top-actions') || document.querySelector('.brandrow');
      if (!top) return;
      wrap = document.createElement('div');
      wrap.className = 'mt-language-switcher';
      wrap.setAttribute('aria-label','Language');
      wrap.innerHTML = '<button type="button" data-locale="ru">RU</button><button type="button" data-locale="vi">VI</button>';
      top.prepend(wrap);
      wrap.addEventListener('click', event => {
        const button = event.target.closest('button[data-locale]');
        if (!button) return;
        const next = button.dataset.locale === 'vi' ? 'vi' : 'ru';
        if (next === locale) return;
        localStorage.setItem(STORAGE_KEY, next);
        location.reload();
      });
    }
    wrap.querySelectorAll('button').forEach(btn => {
      const active = btn.dataset.locale === locale;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',active ? 'true':'false');
    });
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    if (locale === 'vi') {
      try {
        const url = typeof input === 'string' ? input : input && input.url;
        if (url && /\/api\/ai\/chat(?:$|\?)/.test(url) && init && typeof init.body === 'string') {
          const data = JSON.parse(init.body);
          data.locale = 'vi';
          data.context = Object.assign({}, data.context || {}, { locale:'vi' });
          init = Object.assign({}, init, { body:JSON.stringify(data) });
        }
      } catch (_) {}
    }
    return nativeFetch(input, init);
  };

  function refreshCurrentScreen() {
    patchTours();
    try {
      if (typeof state !== 'undefined' && state && typeof showScreen === 'function') {
        showScreen(state.screen || 'home');
      } else if (typeof renderHome === 'function') {
        renderHome();
      }
    } catch (_) {}
    translateNode(document.body);
  }

  renderSwitcher();
  if (locale === 'vi') {
    installViSearchBridge();
    patchTours();
    translateNode(document.body);
    const observer = new MutationObserver(records => {
      patchTours();
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) translateNode(node);
        else if (node.nodeType === Node.TEXT_NODE && /[А-Яа-яЁё]/.test(node.nodeValue || '')) node.nodeValue = tr(node.nodeValue);
      }));
      renderSwitcher();
    });
    observer.observe(document.body,{childList:true,subtree:true});
    [80,250,700,1500].forEach(ms => setTimeout(refreshCurrentScreen, ms));
  }

  globalThis.MaxTourI18n = {
    locale,
    setLocale(next) { localStorage.setItem(STORAGE_KEY, next === 'vi' ? 'vi' : 'ru'); location.reload(); },
    t: tr,
    patchTours
  };
})();