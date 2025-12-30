import React from 'react';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// Action colors
const ACTION_COLORS = {
  'c': '#3b82f6',      // Check/Call - Blue
  'f': '#6b7280',      // Fold - Gray
};

// Generate colors for bet sizes (reds/oranges)
const getBetColor = (action) => {
  if (!action.startsWith('b')) return '#ef4444';
  const size = parseInt(action.substring(1)) || 0;
  // Smaller bets = lighter red, bigger bets = darker red
  if (size < 50) return '#f97316';      // Orange
  if (size < 100) return '#ef4444';     // Red
  if (size < 200) return '#dc2626';     // Dark red
  return '#991b1b';                      // Very dark red
};

const getActionColor = (action) => {
  if (action in ACTION_COLORS) return ACTION_COLORS[action];
  if (action.startsWith('b')) return getBetColor(action);
  return '#a855f7';  // Purple for unknown
};

const getActionLabel = (action) => {
  if (action === 'c') return 'X/C';
  if (action === 'f') return 'Fold';
  if (action.startsWith('b')) return `B${action.substring(1)}`;
  return action;
};

function StrategyGrid({ strategyData }) {
  if (!strategyData || !strategyData.grid) {
    return (
      <div className="strategy-grid-placeholder">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Strategy available from flop
        </p>
      </div>
    );
  }

  const { grid, actions } = strategyData;

  // Calculate total frequency for each cell (sum of action frequencies = % in range)
  const getCellFrequency = (cellActions) => {
    if (!cellActions || Object.keys(cellActions).length === 0) return 0;
    return Math.min(Object.values(cellActions).reduce((sum, freq) => sum + freq, 0), 1);
  };

  const getCellLabel = (row, col) => {
    if (row === col) {
      return RANKS[row] + RANKS[col];  // Pairs: AA, KK
    } else if (row < col) {
      return RANKS[row] + RANKS[col] + 's';  // Suited: AKs
    } else {
      return RANKS[col] + RANKS[row] + 'o';  // Offsuit: AKo
    }
  };

  // Build vertical gradient: gray on top (not in range), strategy colors on bottom (in range)
  const getCellStyle = (cellActions) => {
    const inRangePercent = getCellFrequency(cellActions) * 100;
    const notInRangePercent = 100 - inRangePercent;

    if (inRangePercent === 0) {
      // Not in range at all - full gray
      return { backgroundColor: 'rgba(80, 80, 80, 0.6)' };
    }

    // Get action colors for the in-range portion
    const sortedActions = Object.entries(cellActions || {})
      .filter(([_, freq]) => freq > 0.01)
      .sort((a, b) => b[1] - a[1]);

    if (sortedActions.length === 0) {
      return { backgroundColor: 'rgba(80, 80, 80, 0.6)' };
    }

    // Build gradient parts
    let gradientParts = [];

    // Top portion: gray (not in range)
    if (notInRangePercent > 0) {
      gradientParts.push(`rgba(80, 80, 80, 0.6) 0%`);
      gradientParts.push(`rgba(80, 80, 80, 0.6) ${notInRangePercent.toFixed(1)}%`);
    }

    // Bottom portion: action colors (in range)
    // Normalize action frequencies within the in-range portion
    const totalActionFreq = sortedActions.reduce((sum, [_, f]) => sum + f, 0);
    let cumulative = notInRangePercent;

    for (const [action, freq] of sortedActions) {
      const color = getActionColor(action);
      const actionPercent = (freq / totalActionFreq) * inRangePercent;
      const start = cumulative;
      cumulative += actionPercent;
      gradientParts.push(`${color} ${start.toFixed(1)}%`);
      gradientParts.push(`${color} ${cumulative.toFixed(1)}%`);
    }

    return {
      background: `linear-gradient(to right, ${gradientParts.join(', ')})`,
    };
  };

  const getCellTooltip = (row, col, cellActions) => {
    const handLabel = getCellLabel(row, col);
    if (!cellActions || Object.keys(cellActions).length === 0) {
      return `${handLabel}: Not in range`;
    }

    const parts = Object.entries(cellActions)
      .filter(([_, freq]) => freq > 0.01)
      .sort((a, b) => b[1] - a[1])
      .map(([action, freq]) => `${getActionLabel(action)}: ${(freq * 100).toFixed(0)}%`);

    return `${handLabel}\n${parts.join('\n')}`;
  };

  return (
    <div className="strategy-grid">
      <div className="grid-container">
        {grid.map((row, rowIdx) => (
          <div key={rowIdx} className="grid-row">
            {row.map((cellActions, colIdx) => (
              <div
                key={colIdx}
                className="grid-cell"
                style={getCellStyle(cellActions)}
                title={getCellTooltip(rowIdx, colIdx, cellActions)}
              >
                <span className="cell-label">{getCellLabel(rowIdx, colIdx)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      {actions && actions.length > 0 && (
        <div className="strategy-legend">
          {actions.map((action) => (
            <div key={action} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: getActionColor(action) }}
              />
              <span>{getActionLabel(action)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StrategyGrid;
