import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'ru' | 'vi';

type I18nContextValue = {
  locale: Locale;
  enabled: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
};

const STORAGE_KEY = 'max-tour-locale';

const ru: Record<string, string> = {
  'lang.ru': 'RU',
  'lang.vi': 'VI',
  'nav.home': 'Главная',
  'nav.tours': 'Экскурсии',
  'nav.trips': 'Мои поездки',
  'nav.help': 'Помощь',
  'nav.home.sub': 'Вдохновение и подборки',
  'nav.tours.sub': 'Каталог по направлениям',
  'nav.trips.sub': 'Брони и детали путешествий',
  'nav.help.sub': 'Условия, оплата и поддержка',

  'home.hero.1': 'Вьетнам,',
  'home.hero.2': 'который хочется',
  'home.hero.3': 'прожить.',
  'home.hero.text': 'Более 150 маршрутов по стране — премиум-экскурсии, небольшие группы, индивидуальные программы, трансферы и авторские путешествия.',
  'home.choose': 'Выбрать путешествие',
  'home.premium': 'Премиум коллекция →',
  'home.tours': 'экскурсий',
  'home.destinations': 'направлений',
  'home.online': 'выбор онлайн',
  'home.forYou': 'СОБРАНО ДЛЯ ВАС',
  'home.journeyTitle': 'Путешествие начинается ещё до встречи с гидом',
  'home.journeyText': 'Выберите маршрут, дату и состав группы, посмотрите программу и детали, оформите бронь и пройдите демонстрационный сценарий оплаты — всё в одном интерфейсе.',
  'home.premiumLabel': 'ПРЕМИУМ ВЫБОР',
  'home.openProgram': 'Открыть программу',
  'home.collection': 'КОЛЛЕКЦИЯ',
  'home.popular': 'Популярные экскурсии',
  'home.all': 'Смотреть все →',
  'home.smallGroups': 'Небольшие группы',
  'home.smallGroupsText': 'Комфортный формат, в котором проще слышать гида и чувствовать маршрут.',
  'home.private': 'Индивидуально',
  'home.privateText': 'Большинство программ можно адаптировать под персональный сценарий поездки.',
  'home.hotelPickup': 'Забираем из отеля',
  'home.hotelPickupText': 'Трансфер учитывается при оформлении и рассчитывается по зоне проживания.',
  'home.clearPrice': 'Понятная стоимость',
  'home.clearPriceText': 'Состав заказа и доплаты видны до подтверждения бронирования.',
  'home.nextTrip': 'БЛИЖАЙШАЯ ПОЕЗДКА',
  'common.open': 'Открыть →',
  'common.details': 'Подробнее →',

  'tour.about': 'О МАРШРУТЕ',
  'tour.detailsTitle': 'День, собранный по деталям',
  'tour.pickup': 'Сбор',
  'tour.back': 'Возвращение',
  'tour.format': 'Формат',
  'tour.formatValue': 'Группа / индивидуально',
  'tour.gallery': 'ФОТОИСТОРИЯ',
  'tour.program': 'ПРОГРАММА',
  'tour.steps': 'По шагам',
  'tour.included': 'УЖЕ ВКЛЮЧЕНО',
  'tour.inTrip': 'В поездке',
  'tour.extra': 'ДОПОЛНИТЕЛЬНО',
  'tour.take': 'ЧТО ВЗЯТЬ',
  'tour.before': 'Перед выездом',
  'tour.source': 'Источник программы и условий',
  'tour.official': 'Официальная страница MAX TOUR ↗',
  'tour.from': 'от',
  'tour.chooseFormat': 'Выбрать формат',
  'common.back': '← Назад',

  'booking.title': 'Бронирование экскурсии',
  'booking.subtitle': 'Индивидуальный тур — расчёт и выбор 30% или 100%. Групповой — отдельная система сбора выезда.',
  'booking.noCharge': 'DEMO · БЕЗ СПИСАНИЯ',
  'booking.step1': '01 · ТУР И ФОРМАТ',
  'booking.what': 'Что хотите забронировать?',
  'booking.tour': 'Экскурсия',
  'booking.private': 'Индивидуальный',
  'booking.privateNote': 'Своя компания · выбранная дата · online-оплата',
  'booking.group': 'Групповой',
  'booking.groupNote': 'Присоединиться к сбору или создать свой выезд',
  'booking.payment': 'Оплата MAX TOUR',
  'booking.paymentNote': '30% депозит или 100% — выбирает клиент.',
  'booking.continuePrivate': 'Продолжить индивидуально',
  'booking.step2': '02 · СОСТАВ',
  'booking.who': 'Кто едет?',
  'booking.adults': 'Взрослые',
  'booking.children': 'Дети',
  'booking.age': 'Возраст, лет',
  'booking.selectDate': 'Выбрать дату',
  'booking.step3': '03 · ДАТА И ТРАНСФЕР',
  'booking.when': 'Когда едем?',
  'booking.desiredDate': 'Желаемая дата',
  'booking.hotel': 'Отель',
  'booking.transferAuto': 'Трансфер считается автоматически',
  'booking.travelers': 'Данные путешественников',
  'booking.step4': '04 · КОНТАКТ И УЧАСТНИКИ',
  'booking.confirmData': 'Данные для подтверждения',
  'booking.name': 'Ваше имя',
  'booking.phone': 'Телефон',
  'booking.fullName': 'ФИО',
  'booking.birthDate': 'Дата рождения',
  'booking.total': 'Получить итоговую стоимость',
  'booking.step5': '05 · ОПЛАТА',
  'booking.totalNote': 'Итог рассчитан сервером. Выберите, сколько оплатить сейчас.',
  'booking.cancel': 'Перенос и отмена',
  'booking.confirmation': 'ПОДТВЕРЖДЕНИЕ',
  'booking.created': 'Бронирование создано. После успешной оплаты клиент получит подтверждение в Telegram, а заказ появится в общей CRM.',
  'booking.paid': 'Оплачено',
  'booking.remaining': 'Осталось',
  'booking.openTrip': 'Открыть поездку',

  'catalog.kicker': 'MAX TOUR · ОФИЦИАЛЬНЫЙ КАТАЛОГ',
  'catalog.title': 'Куда поедем?',
  'catalog.text': 'Экскурсии и путешествия собраны напрямую с сайта MAX TOUR. Фильтры помогают выбрать по месту и стилю отдыха; неподтверждённые тарифы система не придумывает.',
  'catalog.source': 'Источник',
  'catalog.search': 'Поиск',
  'catalog.place': 'Место',
  'catalog.style': 'Стиль отдыха',
  'catalog.children': 'Показать туры, где на странице есть детские условия',
  'catalog.results': 'подходящих вариантов',

  'trips.kicker': 'ЛИЧНЫЙ КАБИНЕТ',
  'trips.title': 'Мои поездки',
  'trips.subtitle': 'Все оформленные бронирования этой демо-сессии.',
  'trips.empty': 'Пока нет поездок',
  'trips.emptyText': 'Выберите экскурсию и пройдите демонстрационное бронирование.',
  'trips.choose': 'Выбрать экскурсию',

  'help.title': 'Помощь',
  'help.how': 'Как проходит бронирование?',
  'help.payment': 'Какие способы оплаты указаны MAX TOUR?',
  'help.cancel': 'Отмена и перенос',
  'help.group': 'Если группа не сформировалась',
  'help.transfer': 'Дополнительный трансфер из удалённых районов',
  'help.weather': 'Погода',
};

const vi: Record<string, string> = {
  'lang.ru': 'RU',
  'lang.vi': 'VI',
  'nav.home': 'Trang chủ',
  'nav.tours': 'Tour',
  'nav.trips': 'Chuyến đi của tôi',
  'nav.help': 'Trợ giúp',
  'nav.home.sub': 'Gợi ý và cảm hứng',
  'nav.tours.sub': 'Danh mục theo điểm đến',
  'nav.trips.sub': 'Đặt chỗ và chi tiết chuyến đi',
  'nav.help.sub': 'Điều kiện, thanh toán và hỗ trợ',

  'home.hero.1': 'Việt Nam,',
  'home.hero.2': 'một hành trình',
  'home.hero.3': 'đáng để trải nghiệm.',
  'home.hero.text': 'Hơn 150 hành trình trên khắp Việt Nam — tour cao cấp, nhóm nhỏ, chương trình riêng, đưa đón và hành trình đặc biệt.',
  'home.choose': 'Chọn hành trình',
  'home.premium': 'Bộ sưu tập cao cấp →',
  'home.tours': 'tour',
  'home.destinations': 'điểm đến',
  'home.online': 'đặt online 24/7',
  'home.forYou': 'DÀNH CHO BẠN',
  'home.journeyTitle': 'Hành trình bắt đầu trước cả khi gặp hướng dẫn viên',
  'home.journeyText': 'Chọn tour, ngày đi và số người, xem chương trình, đặt chỗ và đi qua quy trình thanh toán mẫu — tất cả trong một giao diện.',
  'home.premiumLabel': 'LỰA CHỌN CAO CẤP',
  'home.openProgram': 'Xem chương trình',
  'home.collection': 'BỘ SƯU TẬP',
  'home.popular': 'Tour phổ biến',
  'home.all': 'Xem tất cả →',
  'home.smallGroups': 'Nhóm nhỏ',
  'home.smallGroupsText': 'Thoải mái hơn để nghe hướng dẫn viên và tận hưởng hành trình.',
  'home.private': 'Tour riêng',
  'home.privateText': 'Phần lớn chương trình có thể điều chỉnh theo nhu cầu riêng.',
  'home.hotelPickup': 'Đón tại khách sạn',
  'home.hotelPickupText': 'Phí đưa đón được tính ngay khi đặt theo khu vực lưu trú.',
  'home.clearPrice': 'Chi phí minh bạch',
  'home.clearPriceText': 'Thành phần đơn hàng và phụ phí được hiển thị trước khi xác nhận.',
  'home.nextTrip': 'CHUYẾN ĐI SẮP TỚI',
  'common.open': 'Mở →',
  'common.details': 'Chi tiết →',

  'tour.about': 'VỀ HÀNH TRÌNH',
  'tour.detailsTitle': 'Một ngày được thiết kế đến từng chi tiết',
  'tour.pickup': 'Giờ đón',
  'tour.back': 'Trở về',
  'tour.format': 'Hình thức',
  'tour.formatValue': 'Theo nhóm / riêng',
  'tour.gallery': 'HÌNH ẢNH',
  'tour.program': 'CHƯƠNG TRÌNH',
  'tour.steps': 'Theo từng điểm',
  'tour.included': 'ĐÃ BAO GỒM',
  'tour.inTrip': 'Trong chuyến đi',
  'tour.extra': 'CHI PHÍ THÊM',
  'tour.take': 'CẦN MANG THEO',
  'tour.before': 'Trước khi khởi hành',
  'tour.source': 'Nguồn chương trình và điều kiện',
  'tour.official': 'Trang chính thức MAX TOUR ↗',
  'tour.from': 'từ',
  'tour.chooseFormat': 'Chọn hình thức',
  'common.back': '← Quay lại',

  'booking.title': 'Đặt tour',
  'booking.subtitle': 'Tour riêng — tính giá và chọn thanh toán 30% hoặc 100%. Tour ghép có quy trình đăng ký nhóm riêng.',
  'booking.noCharge': 'DEMO · KHÔNG TRỪ TIỀN',
  'booking.step1': '01 · TOUR VÀ HÌNH THỨC',
  'booking.what': 'Bạn muốn đặt gì?',
  'booking.tour': 'Tour',
  'booking.private': 'Tour riêng',
  'booking.privateNote': 'Nhóm riêng · chọn ngày · thanh toán online',
  'booking.group': 'Tour ghép',
  'booking.groupNote': 'Tham gia nhóm đang ghép hoặc tạo ngày mới',
  'booking.payment': 'Thanh toán MAX TOUR',
  'booking.paymentNote': 'Khách chọn đặt cọc 30% hoặc thanh toán 100%.',
  'booking.continuePrivate': 'Tiếp tục với tour riêng',
  'booking.step2': '02 · SỐ NGƯỜI',
  'booking.who': 'Ai sẽ đi?',
  'booking.adults': 'Người lớn',
  'booking.children': 'Trẻ em',
  'booking.age': 'Tuổi',
  'booking.selectDate': 'Chọn ngày',
  'booking.step3': '03 · NGÀY VÀ ĐƯA ĐÓN',
  'booking.when': 'Khi nào khởi hành?',
  'booking.desiredDate': 'Ngày mong muốn',
  'booking.hotel': 'Khách sạn',
  'booking.transferAuto': 'Phí đưa đón được tính tự động',
  'booking.travelers': 'Thông tin hành khách',
  'booking.step4': '04 · LIÊN HỆ VÀ HÀNH KHÁCH',
  'booking.confirmData': 'Thông tin xác nhận',
  'booking.name': 'Tên của bạn',
  'booking.phone': 'Điện thoại',
  'booking.fullName': 'Họ và tên',
  'booking.birthDate': 'Ngày sinh',
  'booking.total': 'Tính tổng chi phí',
  'booking.step5': '05 · THANH TOÁN',
  'booking.totalNote': 'Tổng tiền được tính trên máy chủ. Chọn số tiền cần thanh toán ngay.',
  'booking.cancel': 'Đổi lịch và hủy',
  'booking.confirmation': 'XÁC NHẬN',
  'booking.created': 'Đặt chỗ đã được tạo. Sau khi thanh toán thành công, khách sẽ nhận xác nhận trên Telegram và đơn hàng xuất hiện trong CRM chung.',
  'booking.paid': 'Đã thanh toán',
  'booking.remaining': 'Còn lại',
  'booking.openTrip': 'Mở chuyến đi',

  'catalog.kicker': 'MAX TOUR · DANH MỤC CHÍNH THỨC',
  'catalog.title': 'Mình đi đâu?',
  'catalog.text': 'Tour và hành trình được lấy trực tiếp từ MAX TOUR. Bộ lọc giúp chọn theo điểm đến và phong cách; hệ thống không tự tạo mức giá chưa được xác nhận.',
  'catalog.source': 'Nguồn',
  'catalog.search': 'Tìm kiếm',
  'catalog.place': 'Điểm đến',
  'catalog.style': 'Phong cách',
  'catalog.children': 'Hiển thị tour có điều kiện dành cho trẻ em',
  'catalog.results': 'lựa chọn phù hợp',

  'trips.kicker': 'TÀI KHOẢN',
  'trips.title': 'Chuyến đi của tôi',
  'trips.subtitle': 'Tất cả đặt chỗ trong phiên demo này.',
  'trips.empty': 'Chưa có chuyến đi',
  'trips.emptyText': 'Chọn tour và hoàn tất quy trình đặt chỗ demo.',
  'trips.choose': 'Chọn tour',

  'help.title': 'Trợ giúp',
  'help.how': 'Quy trình đặt tour diễn ra như thế nào?',
  'help.payment': 'MAX TOUR hỗ trợ những phương thức thanh toán nào?',
  'help.cancel': 'Hủy và đổi lịch',
  'help.group': 'Nếu nhóm không đủ người',
  'help.transfer': 'Phí đưa đón từ khu vực xa',
  'help.weather': 'Thời tiết',
};

const dictionaries: Record<Locale, Record<string, string>> = { ru, vi };

const I18nContext = createContext<I18nContextValue>({
  locale: 'ru',
  enabled: false,
  setLocale: () => undefined,
  t: (key, fallback) => fallback ?? ru[key] ?? key,
});

export function LocaleProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (!enabled || typeof window === 'undefined') return 'ru';
    return window.localStorage.getItem(STORAGE_KEY) === 'vi' ? 'vi' : 'ru';
  });

  useEffect(() => {
    const effective = enabled ? locale : 'ru';
    document.documentElement.lang = effective;
    if (enabled) window.localStorage.setItem(STORAGE_KEY, effective);
  }, [enabled, locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale: enabled ? locale : 'ru',
    enabled,
    setLocale: (next) => {
      if (!enabled) return;
      setLocaleState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
    },
    t: (key, fallback) => dictionaries[enabled ? locale : 'ru'][key] ?? dictionaries.ru[key] ?? fallback ?? key,
  }), [enabled, locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageSwitcher() {
  const { locale, enabled, setLocale } = useI18n();
  if (!enabled) return null;
  return (
    <div className="px-language-switcher" aria-label="Language">
      <button type="button" className={locale === 'ru' ? 'active' : ''} onClick={() => setLocale('ru')}>RU</button>
      <button type="button" className={locale === 'vi' ? 'active' : ''} onClick={() => setLocale('vi')}>VI</button>
    </div>
  );
}
