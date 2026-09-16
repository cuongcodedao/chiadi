/**
 * Khung xám mờ đúng hình dạng nội dung sắp hiện, không dùng vòng xoay.
 * Bố cục khớp màn 3 và màn 10 để trang không nhảy khi dữ liệu về.
 */
export function GroupSkeleton() {
  return (
    <main className="reading min-h-dvh">
      <div className="bar">
        <div>
          <div className="skel h-[17px] w-[132px]" />
          <div className="skel h-[12px] w-[66px] mt-[6px]" />
        </div>
        <div className="skel h-[34px] w-[34px] rounded-full" />
      </div>

      <div className="hero">
        <div className="skel h-[13px] w-[64px]" />
        <div className="skel h-[38px] w-[210px] mt-2" />
        <div className="skel h-[118px] w-full mt14 rounded-[12px]" />
      </div>

      <div className="pad">
        <div className="skel h-[38px] w-full rounded-[9px]" />
      </div>

      <div className="list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="li">
            <div className="grow">
              <div className="skel h-[15px] w-[158px]" />
              <div className="skel h-[12px] w-[124px] mt4" />
            </div>
            <div className="right">
              <div className="skel h-[15px] w-[80px]" />
              <div className="skel h-[12px] w-[46px] mt4 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export function HistorySkeleton() {
  return (
    <main className="reading min-h-dvh">
      <div className="bar justify-start gap-3">
        <div className="skel h-[18px] w-[18px]" />
        <div className="skel h-[17px] w-[150px]" />
      </div>
      <div className="px-4 pt-[6px]">
        <div className="skel h-[12px] w-[62px] mt16" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="act">
            <div className="skel h-[15px] w-[18px]" />
            <div className="grow">
              <div className="skel h-[14px] w-[224px]" />
              <div className="skel h-[12px] w-[44px] mt4" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
