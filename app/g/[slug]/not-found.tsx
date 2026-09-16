import Link from "next/link";

export default function GroupNotFound() {
  return (
    <main className="empty pb-8">
      <div className="blob">🔗</div>
      <div className="text-[17px] font-medium mt14">Không mở được nhóm này</div>
      <p className="t14 m mt6 leading-[1.5]">
        Link có thể bị thiếu mất vài ký tự lúc chép, hoặc nhóm đã bị xóa.
        Nhờ người gửi thả lại link vào nhóm chat giúp bạn.
      </p>
      <Link href="/" className="linkbtn mt18">
        Tạo nhóm mới
      </Link>
    </main>
  );
}
