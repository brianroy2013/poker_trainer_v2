import React from 'react';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// PioSolver-style colors
// Fold = Blue, Check/Call = Green, Bets = Orange/Red shades
const ACTION_COLORS = {
  'c': 'rgb(143, 188, 139)',   // Check/Call - Green
  'f': 'rgb(109, 162, 192)',   // Fold - Blue
};

// Bet colors: smallest = light, largest = dark
const BET_COLOR_SMALL = { r: 233, g: 150, b: 122 };  // Light orange/salmon
const BET_COLOR_LARGE = { r: 177, g: 91, b: 74 };    // Dark red/brown

// Interpolate between two colors based on ratio (0 = small, 1 = large)
const interpolateColor = (ratio) => {
  const r = Math.round(BET_COLOR_SMALL.r + (BET_COLOR_LARGE.r - BET_COLOR_SMALL.r) * ratio);
  const g = Math.round(BET_COLOR_SMALL.g + (BET_COLOR_LARGE.g - BET_COLOR_SMALL.g) * ratio);
  const b = Math.round(BET_COLOR_SMALL.b + (BET_COLOR_LARGE.b - BET_COLOR_SMALL.b) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
};

// Build bet color map based on available bet sizes
const buildBetColorMap = (actions) => {
  const betActions = actions.filter(a => a.startsWith('b'));
  if (betActions.length === 0) return {};

  // Extract and sort bet sizes
  const betSizes = betActions
    .map(a => ({ action: a, size: parseInt(a.substring(1)) || 0 }))
    .sort((a, b) => a.size - b.size);

  const colorMap = {};

  if (betSizes.length === 1) {
    // Single bet: use small color
    colorMap[betSizes[0].action] = interpolateColor(0);
  } else {
    // Multiple bets: interpolate based on position
    betSizes.forEach((bet, index) => {
      const ratio = index / (betSizes.length - 1);
      colorMap[bet.action] = interpolateColor(ratio);
    });
  }

  return colorMap;
};

const getActionColor = (action, betColorMap = {}) => {
  if (action in ACTION_COLORS) return ACTION_COLORS[action];
  if (action in betColorMap) return betColorMap[action];
  if (action.startsWith('b')) return interpolateColor(0.5);  // Fallback
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

  // Build bet color map based on available actions at this node
  const betColorMap = buildBetColorMap(actions || []);

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

  // Build 2D gradient:
  // - Vertical: gray on top (not in range), transparent on bottom (in range)
  // - Horizontal: action colors left-to-right
  const getCellStyle = (cellActions) => {
    const inRangePercent = getCellFrequency(cellActions) * 100;
    const notInRangePercent = 100 - inRangePercent;

    if (inRangePercent === 0) {
      // Not in range at all
      return { backgroundColor: 'rgb(27, 27, 40)' };
    }

    // Get action colors for the in-range portion
    // Order: call/check, bets (smallest to largest), fold
    const getActionOrder = (action) => {
      if (action === 'c') return 0;  // Call/check first
      if (action === 'f') return 1000;  // Fold last
      if (action.startsWith('b')) {
        return 1 + (parseInt(action.substring(1)) || 0);  // Bets in between, sorted by size
      }
      return 500;  // Unknown actions
    };

    const sortedActions = Object.entries(cellActions || {})
      .filter(([_, freq]) => freq > 0.01)
      .sort((a, b) => getActionOrder(a[0]) - getActionOrder(b[0]));

    if (sortedActions.length === 0) {
      return { backgroundColor: 'rgb(27, 27, 40)' };
    }

    // Build horizontal gradient for action colors (left to right)
    let actionGradientParts = [];
    const totalActionFreq = sortedActions.reduce((sum, [_, f]) => sum + f, 0);
    let cumulative = 0;

    for (const [action, freq] of sortedActions) {
      const color = getActionColor(action, betColorMap);
      const actionPercent = (freq / totalActionFreq) * 100;
      const start = cumulative;
      cumulative += actionPercent;
      actionGradientParts.push(`${color} ${start.toFixed(1)}%`);
      actionGradientParts.push(`${color} ${cumulative.toFixed(1)}%`);
    }

    const actionGradient = `linear-gradient(to right, ${actionGradientParts.join(', ')})`;

    // Build vertical overlay: solid color on top (not in range), transparent on bottom
    if (notInRangePercent > 0) {
      const notInRangeOverlay = `linear-gradient(to bottom, rgb(27, 27, 40) 0%, rgb(27, 27, 40) ${notInRangePercent.toFixed(1)}%, transparent ${notInRangePercent.toFixed(1)}%)`;
      return {
        background: `${notInRangeOverlay}, ${actionGradient}`,
      };
    }

    return {
      background: actionGradient,
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
                style={{ backgroundColor: getActionColor(action, betColorMap) }}
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
