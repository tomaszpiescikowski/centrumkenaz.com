import { memo, useMemo } from 'react'
import { compareValues } from './sortUtils'

function SortableDataTable({ columns, rows, sort, onSort, rowKey, emptyText, t }) {
  const sortedRows = useMemo(() => {
    if (!Array.isArray(sort) || sort.length === 0) return rows

    const columnsByKey = new Map(columns.map((col) => [col.key, col]))
    const sortCriteria = sort
      .map((criterion) => {
        const col = columnsByKey.get(criterion.key)
        if (!col) return null
        return {
          ...criterion,
          accessor: col.sortValue || ((row) => row[col.key]),
        }
      })
      .filter(Boolean)

    if (sortCriteria.length === 0) return rows

    return [...rows].sort((left, right) => {
      for (const criterion of sortCriteria) {
        const directionFactor = criterion.direction === 'asc' ? 1 : -1
        const compared = compareValues(criterion.accessor(left), criterion.accessor(right))
        if (compared !== 0) return compared * directionFactor
      }
      return 0
    })
  }, [rows, sort, columns])

  const renderSortIndicator = (key) => {
    if (!Array.isArray(sort)) return null
    const index = sort.findIndex((criterion) => criterion.key === key)
    if (index === -1) return null
    const direction = sort[index].direction === 'asc' ? '↑' : '↓'
    return `${direction}${index + 1}`
  }

  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead className="ui-table-head">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`ui-table-th ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.sortable !== false ? (
                  <button
                    type="button"
                    onClick={() => onSort(col.key)}
                    className={`inline-flex items-center gap-1 transition hover:text-navy dark:hover:text-cream ${col.align === 'right' ? 'justify-end w-full' : ''}`}
                    aria-label={t('admin.tables.sortBy').replace('{column}', String(col.label))}
                  >
                    <span>{col.label}</span>
                    <span className="ui-table-sort-indicator">{renderSortIndicator(col.key)}</span>
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 && (
            <tr className="ui-table-row">
              <td className="ui-table-empty" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          )}
          {sortedRows.map((row) => (
            <tr key={rowKey(row)} className="ui-table-row">
              {columns.map((col) => (
                <td
                  key={`${rowKey(row)}-${col.key}`}
                  className={`ui-table-cell ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default memo(SortableDataTable)
