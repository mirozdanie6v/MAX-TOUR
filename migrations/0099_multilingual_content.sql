PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tour_translations (
  tour_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('ru','vi')),
  title TEXT NOT NULL,
  direction TEXT NOT NULL,
  category TEXT NOT NULL,
  pickup TEXT,
  back TEXT,
  description TEXT NOT NULL,
  program_json TEXT NOT NULL DEFAULT '[]',
  included_json TEXT NOT NULL DEFAULT '[]',
  extra_costs_json TEXT NOT NULL DEFAULT '[]',
  what_to_take_json TEXT NOT NULL DEFAULT '[]',
  badges_json TEXT NOT NULL DEFAULT '[]',
  pricing_text_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tour_id, locale),
  FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS destination_translations (
  destination_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('ru','vi')),
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (destination_id, locale),
  FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE CASCADE
);

INSERT OR REPLACE INTO destination_translations(destination_id,locale,name) VALUES
('d1','vi','Nha Trang'),
('d2','vi','Đà Nẵng'),
('d3','vi','Phú Quốc'),
('d4','vi','Mũi Né / Phan Thiết'),
('d5','vi','Hà Nội');

INSERT OR REPLACE INTO tour_translations(tour_id,locale,title,direction,category,pickup,back,description,program_json,included_json,extra_costs_json,what_to_take_json,badges_json,pricing_text_json) VALUES
('dalat-premium','vi','Tour Đà Lạt “Premium”','Nha Trang','Tour cao cấp','05:00–05:30 đón khách tại khách sạn','Khoảng 20:00 về lại Nha Trang','Chương trình một ngày tại Đà Lạt với đồn điền cà phê, Đường hầm Đất Sét, chùa Linh Phước, thác Datanla và cáp treo.','["Đồn điền cà phê","Đèo núi","Đường hầm Đất Sét","Crazy House","Chùa Linh Phước","Ăn trưa tại nhà hàng","Thác Datanla","Trang trại cà phê và sở thú","Cáp treo"]','["Bữa trưa","Vé tham quan và cáp treo","Hướng dẫn viên chuyên nghiệp nói tiếng Nga","Xe đưa đón","Nhóm thoải mái 14–20 người","Nước uống cho mỗi khách"]','["Xe trượt tại Datanla: $5","Hoạt động tại trang trại: từ $4 đến $16"]','["Trang phục che vai và đầu gối","Bữa sáng","Áo khoác","Áo mưa","Giày thoải mái","Tiền VND cho chi phí nhỏ và quà lưu niệm"]','[]','{"childLabels":["Trẻ em dưới 100 cm — miễn phí","Trẻ em đến 120 cm — $38"]}'),
('phuyen','vi','Tour Phú Yên','Nha Trang','Tour','05:00–05:30 đón khách tại khách sạn','Khoảng 18:30 về lại Nha Trang','Hành trình một ngày đến Phú Yên với các điểm thiên nhiên và lịch sử.','["Tắm biển tại bãi biển hoang sơ","Thành phố Tuy Hòa và tháp Chăm","Tháp Nghinh Phong","Hải đăng trên mũi","Đền Trầm","Ăn trưa tại nhà hàng","Chùa Thanh Lương","Gành Đá Đĩa","Nhà thờ Mằng Lăng"]','["Bữa trưa","Toàn bộ vé tham quan","Hướng dẫn viên chuyên nghiệp nói tiếng Nga","Xe đưa đón","Nhóm thoải mái 14–20 người","Nước uống"]','[]','["Mũ và kem chống nắng","Bữa sáng","Giày thoải mái","Đồ bơi","Tiền VND cho chi phí nhỏ và quà lưu niệm"]','[]','{"childLabels":["Trẻ dưới 2 tuổi — miễn phí","Trẻ cao đến 120 cm — $30"]}'),
('dalat-vip','vi','Tour Đà Lạt “VIP”','Nha Trang','Tour','05:00–05:30 đón khách tại khách sạn','Khoảng 20:00 về lại Nha Trang','Tour một ngày tại Đà Lạt theo chương trình VIP.','["Đồn điền cà phê","Làng Hobbit","Đèo núi","Đường hầm Đất Sét","Crazy House","Chùa Linh Phước","Tượng Phật vàng lớn","Thử sản phẩm miễn phí","Ăn trưa","Thác Datanla","Trang trại động vật"]','["Bữa trưa","Toàn bộ vé tham quan","Hướng dẫn viên chuyên nghiệp nói tiếng Nga","Xe đưa đón","Nhóm thoải mái 14–20 người","Nước uống"]','["Xe trượt tại Datanla: $5","Hoạt động tại trang trại: từ $4 đến $16"]','["Trang phục che vai và đầu gối","Bữa sáng","Áo khoác","Áo mưa","Giày thoải mái","Tiền VND cho chi phí nhỏ và quà lưu niệm"]','[]','{"childLabels":["Trẻ dưới 2 tuổi — miễn phí","Trẻ cao đến 120 cm — $32"]}'),
('dalat-glass','vi','Tour Đà Lạt “Cầu kính”','Nha Trang','Tour','05:00–05:30 đón khách tại khách sạn','Khoảng 20:00 về lại Nha Trang','Chương trình một ngày tại Đà Lạt với điểm nhấn là cầu kính.','["Đồn điền cà phê","Đèo núi","Đường hầm Đất Sét","Crazy House","Chùa Linh Phước","Ăn trưa","Thác Datanla","Trang trại cà phê và sở thú","Cầu kính"]','["Bữa trưa","Toàn bộ vé tham quan","Hướng dẫn viên chuyên nghiệp nói tiếng Nga","Xe đưa đón","Nhóm thoải mái 14–20 người","Nước uống"]','["Xe trượt tại Datanla: $5","Hoạt động tại trang trại: từ $4 đến $16"]','["Trang phục che vai và đầu gối","Bữa sáng","Áo khoác","Áo mưa","Giày thoải mái","Tiền VND cho chi phí nhỏ và quà lưu niệm"]','[]','{"childLabels":["Trẻ dưới 2 tuổi — miễn phí","Trẻ cao đến 120 cm — $32"]}'),
('nha-day','vi','City tour Nha Trang ban ngày','Nha Trang','Tham quan thành phố','09:00 đón khách tại khách sạn','14:00 về khách sạn','Chương trình tham quan Nha Trang ban ngày.','["Chùa Long Sơn và tượng Phật Trắng","Nhà thờ Núi Nha Trang","Hòn Chồng","Chùa Trúc Lâm Phụng","Tháp Bà Ponagar","Bãi biển phía Bắc Nha Trang","Ăn trưa tại nhà hàng"]','["Bữa trưa","Toàn bộ vé tham quan","Hướng dẫn viên chuyên nghiệp nói tiếng Nga","Xe đưa đón","Nhóm thoải mái 14–20 người","Nước uống"]','[]','["Trang phục che vai và đầu gối","Mũ và kem chống nắng","Tiền VND cho chi phí nhỏ và quà lưu niệm"]','[]','{}'),
('nha-evening','vi','City tour Nha Trang buổi tối','Nha Trang','Tham quan thành phố','14:00 đón khách tại khách sạn','20:30 về khách sạn','Tour tham quan Nha Trang buổi tối với bữa tối và chương trình biểu diễn dân tộc.','["Chùa Đa Bảo","Hòn Chồng","Nhà thờ Núi Nha Trang","Nhà hát Đó","Tháp Bà Ponagar","Chùa Long Sơn và tượng Phật Trắng","Nhà hàng Old Nha Trang"]','["Buffet hải sản và chương trình biểu diễn dân tộc","Toàn bộ vé tham quan","Hướng dẫn viên chuyên nghiệp nói tiếng Nga","Xe đưa đón","Nhóm thoải mái 14–20 người","Nước uống"]','[]','["Trang phục che vai và đầu gối","Mũ và kem chống nắng","Tiền VND cho chi phí nhỏ và quà lưu niệm"]','[]','{}'),
('dalat-2d','vi','Tour Đà Lạt 2 ngày','Nha Trang','Tour nhiều ngày','05:00–05:30 đón khách tại khách sạn (ngày 1)','Khoảng 18:30 về lại Nha Trang (ngày 2)','Chương trình Đà Lạt 2 ngày: gói “Standard” hoặc “+ Cầu kính”.','["Đồn điền cà phê","Đèo núi","Đường hầm Đất Sét","Crazy House","Chùa Linh Phước","Thác Datanla","Trang trại cà phê và sở thú","Cầu kính","Chùa Linh Ẩn","Thác Pongour","Ga Đà Lạt","Xưởng lụa gia đình","Cáp treo","Thác Voi"]','["Bữa sáng và hai bữa trưa","Toàn bộ vé tham quan","Hướng dẫn viên chuyên nghiệp nói tiếng Nga","Xe đưa đón","1 đêm khách sạn 3★","Nước uống"]','["Bữa tối không bao gồm","Xe trượt tại Datanla: $5","Hoạt động tại trang trại: từ $4 đến $16"]','["Trang phục che vai và đầu gối","Áo khoác","Áo mưa","Giày thoải mái","Hộ chiếu bản gốc","Tiền VND cho bữa tối, chi phí nhỏ và quà lưu niệm"]','[]','{}'),
('hanoi-halong','vi','Hà Nội và Vịnh Hạ Long bằng máy bay (2 ngày / 1 đêm)','Hà Nội','Tour nhiều ngày','Đón từ khách sạn ra sân bay Cam Ranh','Chuyến bay Hà Nội – Nha Trang','Hành trình riêng từ Nha Trang đến Hà Nội và Vịnh Hạ Long, bao gồm chuyến bay và du thuyền Diamond Era Cruise 5★.','["Sân bay Cam Ranh","Hà Nội","Chùa Trấn Quốc","City tour","Chùa Một Cột","Quảng trường Ba Đình và Lăng Chủ tịch Hồ Chí Minh","Văn Miếu","Phố cổ Hà Nội","Vịnh Hạ Long","Hang Sửng Sốt","Hang Luồn","Đảo Titop","Trở về Hà Nội"]','["Các bữa ăn theo chương trình","Vé máy bay","Toàn bộ vé tham quan","Hướng dẫn viên nói tiếng Nga tại Hà Nội","Hướng dẫn viên nói tiếng Anh trên du thuyền","Đưa đón theo chương trình","Khách sạn 3★ tại Hà Nội","Du thuyền Diamond Era Cruise 5★","Các hoạt động theo chương trình"]','[]','["Hộ chiếu để bay, nhận phòng khách sạn và đăng ký du thuyền","Tiền VND cho chi phí nhỏ và quà lưu niệm"]','[]','{}');
