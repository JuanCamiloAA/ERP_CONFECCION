<?php

namespace App\Services\DataImport;

use League\Csv\Reader;

final class DataImportCsvPreview
{
    /**
     * @return array{
     *     headers: list<string>,
     *     rows: list<list<string>>,
     *     truncated: bool,
     *     total_data_rows: int
     * }
     */
    public static function fromContents(string $contents, int $maxRows = 50): array
    {
        $maxRows = max(1, min($maxRows, 200));

        $contents = preg_replace('/^\xEF\xBB\xBF/u', '', $contents) ?? $contents;

        $reader = Reader::createFromString($contents);
        $reader->setHeaderOffset(0);

        $headers = array_map(
            static fn ($h) => trim((string) $h),
            $reader->getHeader(),
        );

        $rows = [];
        $dataRowCount = 0;
        $truncated = false;

        foreach ($reader->getRecords() as $record) {
            if (self::rowIsEmpty($record)) {
                continue;
            }

            $dataRowCount++;

            if (count($rows) >= $maxRows) {
                $truncated = true;

                continue;
            }

            $line = [];
            foreach ($headers as $header) {
                $value = $record[$header] ?? '';
                $line[] = $value === null ? '' : (string) $value;
            }
            $rows[] = $line;
        }

        return [
            'headers' => $headers,
            'rows' => $rows,
            'truncated' => $truncated,
            'total_data_rows' => $dataRowCount,
        ];
    }

    /**
     * @param  array<int|string, mixed>  $record
     */
    private static function rowIsEmpty(array $record): bool
    {
        foreach ($record as $v) {
            if ($v !== null && trim((string) $v) !== '') {
                return false;
            }
        }

        return true;
    }
}
