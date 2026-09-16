import type { Metadata } from "next";

import { CreateGroupForm } from "./create-group-form";
import { RecentGroups } from "./recent-groups";

export const metadata: Metadata = {
  title: "ChiaDi — chia tiền nhóm bằng một đường link",
  description:
    "Tạo nhóm, thả link vào nhóm chat. Ai trả gì tự thêm, ChiaDi nói rõ ai nợ ai và dựng sẵn mã QR chuyển khoản. Không cần cài app, không cần tài khoản.",
};

export default function Home() {
  return (
    <main className="wide">
      <SiteNav />
      <Hero />
      <RecentGroups />
      <Features />
      <Flow />
      <Screens />
      <Faq />
      <ClosingCta />
      <SiteFooter />
    </main>
  );
}

function Mark() {
  return (
    <span className="brand">
      <span className="brandmark" aria-hidden>
        ₫
      </span>
      ChiaDi
    </span>
  );
}

function SiteNav() {
  return (
    <header className="nav">
      <div className="lpin navrow">
        <Mark />
        <nav className="navlinks">
          <a href="#tinh-nang">Tính năng</a>
          <a href="#cach-dung">Cách dùng</a>
          <a href="#cau-hoi">Câu hỏi</a>
        </nav>
        <a href="#tao-nhom" className="cta">
          Tạo nhóm
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="lp heropad">
      <div className="lpin herogrid">
        <div>
          <h1 className="display">Chia tiền nhóm bằng một đường link</h1>
          <p className="lede mt16">
            Một người tạo nhóm, cả nhóm mở link và tự thêm khoản mình đã trả.
            ChiaDi nói rõ ai nợ ai, kèm mã QR chuyển khoản điền sẵn số tiền.
          </p>

          <ul className="marks mt18">
            <li>Không cần cài app</li>
            <li>Không cần tài khoản</li>
            <li>Miễn phí</li>
          </ul>

          <div id="tao-nhom" className="formcard mt22">
            <CreateGroupForm />
          </div>
        </div>

        <div className="shotwrap">
          <PhoneBalance />
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      title: "Cả nhóm cùng nhập",
      body: "Ai trả thì người đó thêm khoản, ngay tại quầy. Không dồn hết việc lên một người rồi chụp màn hình gửi nhóm.",
    },
    {
      title: "Trả gọn nhất có thể",
      body: "Năm người nợ chéo nhau vẫn gom về tối đa bốn lần chuyển. ChiaDi tự tính, không ai phải ngồi cấn trừ.",
    },
    {
      title: "QR điền sẵn số tiền",
      body: "Bấm Quét QR là app ngân hàng mở ra với đúng số tiền và nội dung chuyển khoản. Không gõ lại con số nào.",
    },
    {
      title: "Chia đều, nhập tay, theo suất",
      body: "Người ăn chay không trả tiền lẩu, hai người ở chung phòng tính hai suất. Phần lẻ chia tới từng đồng.",
    },
    {
      title: "Lịch sử không xóa được",
      body: "Mỗi lần thêm, sửa, xóa đều ghi lại kèm giá trị cũ và người thao tác. Có gì thắc mắc thì mở ra xem.",
    },
    {
      title: "Số liệu không bay mất",
      body: "Dữ liệu nằm trên máy chủ, không nằm trong máy một người. Đổi điện thoại, mở lại link là thấy đủ.",
    },
  ];

  return (
    <section id="tinh-nang" className="lp band">
      <div className="lpin">
        <h2 className="h2">Đủ dùng cho một chuyến đi thật</h2>
        <div className="grid3 mt22">
          {items.map((item) => (
            <article key={item.title} className="tile">
              <h3 className="t15 b">{item.title}</h3>
              <p className="t14 m mt6 leading-[1.6]">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Flow() {
  const steps = [
    {
      title: "Tạo nhóm",
      body: "Gõ tên chuyến đi và tên cả nhóm. Khoảng hai mươi giây.",
    },
    {
      title: "Gửi link",
      body: "Thả vào nhóm chat. Ai mở cũng chọn được tên mình.",
    },
    {
      title: "Thêm khoản chi",
      body: "Ai trả thì tự nhập. Số dư đổi ngay cho cả nhóm.",
    },
    {
      title: "Quét QR trả nhau",
      body: "Chuyển xong đánh dấu một cái là nhóm về không.",
    },
  ];

  return (
    <section id="cach-dung" className="lp">
      <div className="lpin">
        <h2 className="h2">Cách dùng</h2>
        <ol className="grid4 mt22">
          {steps.map((step) => (
            <li key={step.title} className="stepcard">
              <h3 className="t15 b">{step.title}</h3>
              <p className="t14 m mt6 leading-[1.6]">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Screens() {
  return (
    <section className="lp band">
      <div className="lpin">
        <h2 className="h2">Ba màn hình cả nhóm sẽ dùng</h2>
        <div className="grid3 mt22 shots">
          <figure>
            <PhoneExpenses />
            <figcaption className="t13 m mt10">
              Khoản chi của cả nhóm, ai trả và chia cho mấy người.
            </figcaption>
          </figure>
          <figure>
            <PhoneSettle />
            <figcaption className="t13 m mt10">
              Số dư từng người và cách trả gọn nhất.
            </figcaption>
          </figure>
          <figure>
            <PhoneQr />
            <figcaption className="t13 m mt10">
              Mã QR kèm số tiền và nội dung chuyển khoản.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: "Có phải tải app không?",
      a: "Không. ChiaDi chạy trên trình duyệt, mở link là dùng được trên mọi điện thoại và máy tính.",
    },
    {
      q: "Có phải đăng ký tài khoản không?",
      a: "Không. Lần đầu mở link bạn chỉ chọn tên mình trong danh sách, trình duyệt nhớ giúp cho những lần sau.",
    },
    {
      q: "Ai có link thì làm được gì?",
      a: "Xem và sửa mọi khoản chi trong nhóm. Đó là cái giá để cả nhóm không phải đăng nhập, nên hãy giữ link trong nhóm chat thay vì đăng công khai. Mọi thay đổi đều ghi vào lịch sử kèm tên người thao tác.",
    },
    {
      q: "Chuyển tiền ngay trong ChiaDi được không?",
      a: "Không. ChiaDi dựng mã QR theo chuẩn VietQR, còn việc chuyển tiền do app ngân hàng của bạn thực hiện. Tiền không đi qua ChiaDi.",
    },
    {
      q: "Nhóm bao nhiêu người thì dùng được?",
      a: "Tối đa năm mươi người trong một nhóm, không giới hạn số khoản chi.",
    },
    {
      q: "Mất link thì sao?",
      a: "Không có cách lấy lại, vì không có tài khoản nào để tra. Hỏi lại người đã gửi, hoặc ghim link trong nhóm chat ngay từ đầu.",
    },
  ];

  return (
    <section id="cau-hoi" className="lp">
      <div className="lpin narrow">
        <h2 className="h2">Câu hỏi thường gặp</h2>
        <div className="mt22">
          {items.map((item) => (
            <details key={item.q} className="qa">
              <summary>{item.q}</summary>
              <p className="t14 m mt8 leading-[1.6]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="lp">
      <div className="lpin">
        <div className="closing">
          <h2 className="h2">Chuyến sau không ai phải đi đòi nữa</h2>
          <p className="lede mt12">
            Tạo nhóm trước khi đi, thả link vào nhóm chat, xong.
          </p>
          <a href="#tao-nhom" className="cta big mt18">
            Tạo nhóm
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="foot2">
      <div className="lpin footrow">
        <Mark />
        <nav className="navlinks">
          <a href="#tinh-nang">Tính năng</a>
          <a href="#cach-dung">Cách dùng</a>
          <a href="#cau-hoi">Câu hỏi</a>
        </nav>
        <p className="t13 m">Chia tiền nhóm bằng một đường link.</p>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------- bản dựng ba màn hình */

function PhoneBalance() {
  return (
    <div className="phone">
      <div className="bar">
        <div>
          <div className="gname">Đà Lạt 3N2Đ</div>
          <div className="sub">5 thành viên</div>
        </div>
        <span className="icon" aria-hidden>
          ↗
        </span>
      </div>
      <div className="hero">
        <div className="lbl">Bạn đang</div>
        <div className="big neg">nợ 450.000đ</div>
        <div className="card mt14">
          <PayRow name="Minh" amount="280.000đ" />
          <PayRow name="Trang" amount="170.000đ" />
        </div>
      </div>
    </div>
  );
}

function PayRow({ name, amount }: { name: string; amount: string }) {
  return (
    <div className="row">
      <span className="av">{name.charAt(0)}</span>
      <div className="grow">
        <div className="t15">Trả {name}</div>
        <div className="t15 b text-[16px]">{amount}</div>
      </div>
      <div className="flex flex-col gap-[5px] items-end">
        <span className="pill">Quét QR</span>
        <span className="t12 m">Đã chuyển</span>
      </div>
    </div>
  );
}

function PhoneExpenses() {
  const rows = [
    { title: "Ăn tối quán nướng", sub: "Minh trả · chia cho 5 người", amount: "850.000đ" },
    {
      title: "Tiền phòng homestay",
      sub: "Trang và Hùng trả · chia cho 5 người",
      amount: "1.800.000đ",
    },
    { title: "Cà phê sáng", sub: "Bạn trả · chia cho 3 người", amount: "165.000đ" },
    { title: "Xăng xe", sub: "Huy trả · chia theo suất", amount: "420.000đ" },
  ];

  return (
    <div className="phone">
      <div className="bar">
        <div>
          <div className="gname">Đà Lạt 3N2Đ</div>
          <div className="sub">5 thành viên</div>
        </div>
      </div>
      <div className="pad pt-[14px]">
        <div className="tabs">
          <span className="on">Khoản chi</span>
          <span>Số dư cả nhóm</span>
        </div>
      </div>
      <div className="list pb-[14px]">
        {rows.map((row) => (
          <div key={row.title} className="li">
            <div className="grow">
              <div className="t15">{row.title}</div>
              <div className="t12 m mt4">{row.sub}</div>
            </div>
            <div className="right">
              <div className="t15 b">{row.amount}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneSettle() {
  const balances = [
    { name: "Lân", amount: "−620.000đ", tone: "neg" },
    { name: "Hùng", amount: "−450.000đ", tone: "neg" },
    { name: "Huy", amount: "0đ", tone: "m" },
    { name: "Trang", amount: "+390.000đ", tone: "pos" },
    { name: "Minh", amount: "+680.000đ", tone: "pos" },
  ];

  return (
    <div className="phone">
      <div className="bar">
        <div>
          <div className="gname">Đà Lạt 3N2Đ</div>
          <div className="sub">5 thành viên</div>
        </div>
      </div>
      <div className="pad pt-[14px]">
        <div className="tabs">
          <span>Khoản chi</span>
          <span className="on">Số dư cả nhóm</span>
        </div>
      </div>
      <div className="list">
        {balances.map((balance) => (
          <div key={balance.name} className="bal">
            <span className="inl">
              <span className="av">{balance.name.charAt(0)}</span>
              <span className="t15">{balance.name}</span>
            </span>
            <span className={`t15 b ${balance.tone}`}>{balance.amount}</span>
          </div>
        ))}
      </div>
      <div className="pad pb-[14px]">
        <div className="card mt14 p-[14px]">
          <div className="t14 b">Cách trả gọn nhất</div>
          <div className="t12 m mt4">3 lần chuyển thay vì 8</div>
          <div className="stack mt12">
            <div className="inl t14">
              <span>Lân</span>
              <span className="m">→</span>
              <span>Minh</span>
              <span className="ml-auto b">400.000đ</span>
            </div>
            <div className="inl t14">
              <span>Lân</span>
              <span className="m">→</span>
              <span>Trang</span>
              <span className="ml-auto b">220.000đ</span>
            </div>
            <div className="inl t14">
              <span>Hùng</span>
              <span className="m">→</span>
              <span>Minh</span>
              <span className="ml-auto b">280.000đ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneQr() {
  return (
    <div className="phone">
      <div className="qrpane">
        <div className="t13 m">Chuyển cho Minh</div>
        <div className="text-[30px] font-medium tracking-[-.5px] mt4">280.000đ</div>
        <div className="qr">
          <QrGlyph />
        </div>
        <div className="t14 mt14">Vietcombank · 0071000123456</div>
        <div className="t13 m mt4">NGUYEN VAN MINH</div>
        <div className="t13 m mt8">Nội dung: DA LAT 3N2D HUNG</div>
        <div className="t13 mt18" style={{ color: "var(--color-accent)" }}>
          Đánh dấu đã chuyển
        </div>
      </div>
    </div>
  );
}

/** Ô vuông gợi hình mã QR — không phải mã thật, nên không quét được. */
function QrGlyph() {
  const cells = [
    "1110111011101110",
    "1000100010001010",
    "1011101110111010",
    "1000001000101110",
    "1110111011100010",
    "0010001000101110",
    "1110111011101000",
    "1000101000101110",
    "1011100011100010",
    "0010001110001110",
    "1110101010111000",
    "1000100010001110",
    "1011101110101010",
    "1000001000101110",
    "1110111011100010",
    "1010001010101110",
  ];

  return (
    <svg viewBox="0 0 16 16" className="qrglyph" role="img" aria-label="Mã QR minh họa">
      {cells.map((rowBits, y) =>
        rowBits
          .split("")
          .map((bit, x) =>
            bit === "1" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null,
          ),
      )}
    </svg>
  );
}
