import { FileList } from "./FileList";
import { HashVerification } from "./HashVerification";
import { ProgressSection } from "./ProgressSection";
import { ResultSection } from "./ResultSection";

/** 主内容区域组件，垂直排列各功能区块 */
export function ContentArea() {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <FileList />
      <HashVerification />
      <ProgressSection />
      <ResultSection />
    </div>
  );
}
