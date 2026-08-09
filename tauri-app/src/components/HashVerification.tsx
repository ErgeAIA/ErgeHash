import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GitCompare, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store/appStore";
import { quickCalculateHash, openFileDialog } from "@/services/api";


/** 哈希验证区域组件，对应原始 "验证哈希值 (可选)" GroupBox */
export function HashVerification() {
  const { t } = useTranslation();
  const expectedHash = useAppStore((s) => s.expectedHash);
  const setExpectedHash = useAppStore((s) => s.setExpectedHash);
  const fileList = useAppStore((s) => s.fileList);
  const setResultText = useAppStore((s) => s.setResultText);
  const algorithm = useAppStore((s) => s.algorithm);

  /** 比较哈希值 */
  const handleCompareHash = useCallback(() => {
    const expected = expectedHash.trim();
    if (!expected) {
      setResultText((prev) => prev + `\n⚠ ${t("please_enter_expected")}\n`);
      return;
    }

    // 收集已计算哈希值的文件
    const calculatedResults = fileList
      .filter((f) => f.hashValue)
      .map((f) => ({ path: f.path, hash: f.hashValue! }));

    if (calculatedResults.length === 0) {
      setResultText((prev) => prev + `\n⚠ ${t("please_calculate_hash")}\n`);
      return;
    }

    // 按行分割预期哈希值
    const expectedLines = expected
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let resultText = `\n${t("comparison_results")}\n\n`;
    let matchCount = 0;
    let mismatchCount = 0;

    if (expectedLines.length === 1) {
      // 单行预期值：与所有文件结果比较
      const expectedClean = expectedLines[0].toLowerCase().replace(/\s/g, "");

      // 验证格式
      if (!/^[0-9a-f]+$/i.test(expectedClean)) {
        setResultText(
          (prev) => prev + `\n⚠ ${t("invalid_hash_format")}\n`,
        );
        return;
      }

      for (const item of calculatedResults) {
        const fileName = item.path.split(/[/\\]/).pop() ?? item.path;
        const calculatedClean = item.hash.toLowerCase().replace(/\s/g, "");

        if (calculatedClean === expectedClean) {
          resultText += `✓ ${fileName} ${t("match")}\n`;
          matchCount++;
        } else {
          resultText += `✗ ${fileName} ${t("mismatch")}\n`;
          mismatchCount++;
        }
      }
    } else {
      // 多行预期值：逐行与文件比较
      if (expectedLines.length !== calculatedResults.length) {
        setResultText(
          (prev) => prev + `\n⚠ ${t("lines_mismatch")}\n`,
        );
        return;
      }

      for (let i = 0; i < expectedLines.length; i++) {
        const expectedClean = expectedLines[i].toLowerCase().replace(/\s/g, "");
        const fileName =
          calculatedResults[i].path.split(/[/\\]/).pop() ??
          calculatedResults[i].path;
        const calculatedClean = calculatedResults[i].hash
          .toLowerCase()
          .replace(/\s/g, "");

        // 验证格式
        if (!/^[0-9a-f]+$/i.test(expectedClean)) {
          resultText += `${i + 1}. ✗ ${t("format_error")}\n`;
          mismatchCount++;
          continue;
        }

        if (calculatedClean === expectedClean) {
          resultText += `${i + 1}. ✓ ${fileName} ${t("match")}\n`;
          matchCount++;
        } else {
          resultText += `${i + 1}. ✗ ${fileName} ${t("mismatch")}\n`;
          mismatchCount++;
        }
      }
    }

    resultText += `\n---\n${t("total_summary")}: ${calculatedResults.length} | ${t("match")}: ${matchCount} | ${t("mismatch")}: ${mismatchCount}\n`;

    setResultText((prev) => prev + resultText);
  }, [expectedHash, fileList, setResultText, t]);

  /** 快速比较 */
  const handleQuickCompare = useCallback(async () => {
    try {
      let file1: string | null = null;
      let file2: string | null = null;

      if (fileList.length >= 2) {
        // 使用列表中前两个文件
        file1 = fileList[0].path;
        file2 = fileList[1].path;

        if (fileList.length > 2) {
          setResultText(
            (prev) => prev + `\nℹ ${t("multiple_files_hint")}\n`,
          );
        }
      } else {
        // 通过文件对话框选择
        const paths = await openFileDialog();
        if (!paths || paths.length < 2) {
          return;
        }
        file1 = paths[0];
        file2 = paths[1];
      }

      if (!file1 || !file2) return;

      // 计算两个文件的哈希值
      const [result1, result2] = await Promise.all([
        quickCalculateHash(file1, algorithm),
        quickCalculateHash(file2, algorithm),
      ]);

      const name1 = file1.split(/[/\\]/).pop() ?? file1;
      const name2 = file2.split(/[/\\]/).pop() ?? file2;

      if (result1.hash === result2.hash) {
        setResultText(
          (prev) =>
            prev +
            `\n✓ ${t("hash_matches")}\n  ${name1}\n  ${name2}\n`,
        );
      } else {
        setResultText(
          (prev) =>
            prev +
            `\n✗ ${t("hash_mismatch")}\n  ${name1}: ${result1.hash.substring(0, 32)}...\n  ${name2}: ${result2.hash.substring(0, 32)}...\n`,
        );
      }
    } catch {
      setResultText((prev) => prev + `\n✗ ${t("error")}\n`);
    }
  }, [fileList, algorithm, setResultText, t]);

  return (
    <fieldset className="rounded-default border border-border p-3">
      <legend className="px-2 text-sm font-medium text-foreground">
        {t("verify_group")}
      </legend>

      <div className="flex flex-col gap-2">
        {/* 预期哈希值输入 */}
        <Textarea
          value={expectedHash}
          onChange={(e) => setExpectedHash(e.target.value)}
          placeholder={t("expected_hash_placeholder")}
          className="h-[60px] resize-none"
        />

        {/* 按钮行 */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCompareHash}>
            <GitCompare className="mr-1 h-4 w-4" />
            {t("compare_hash")}
          </Button>
          <Button variant="default" size="sm" onClick={handleQuickCompare}>
            <Zap className="mr-1 h-4 w-4" />
            {t("quick_compare")}
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
