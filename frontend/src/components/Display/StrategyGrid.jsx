import React, { useState } from 'react';

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
// actions can be objects {action, amount, total} or strings
const buildBetColorMap = (actions) => {
  const betActions = actions.filter(a => {
    const actionStr = typeof a === 'object' ? a.action : a;
    return actionStr?.startsWith('b');
  });
  if (betActions.length === 0) return {};

  // Extract and sort bet sizes (use amount for actual size when available)
  const betSizes = betActions
    .map(a => {
      const actionStr = typeof a === 'object' ? a.action : a;
      const size = typeof a === 'object' && a.amount != null ? a.amount : (parseInt(actionStr.substring(1)) || 0);
      return { action: actionStr, size };
    })
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

const getActionLabel = (action, isCheck = true, pot = 0, currentBet = 0, actualAmount = null) => {
  if (action === 'c') return isCheck ? 'X' : 'C';
  if (action === 'f') return 'F';
  if (action.startsWith('b')) {
    // Use actualAmount if provided, otherwise parse from action string (fallback for grid cells)
    const amount = actualAmount !== null ? actualAmount : (parseInt(action.substring(1)) || 0);
    if (currentBet > 0) {
      // It's a raise - show multiplier
      const multiplier = amount / currentBet;
      const multDisplay = multiplier % 1 === 0 ? multiplier.toFixed(0) : multiplier.toFixed(1);
      return `R${amount} (${multDisplay}x)`;
    } else {
      // It's a bet - show pot percentage
      const pct = pot > 0 ? Math.round((amount / pot) * 100) : 0;
      return `B${amount} (${pct}%)`;
    }
  }
  return action;
};

// Format action for display (similar to Seat.jsx getActionSymbol)
const BIG_BLIND = 5;
const getActionSymbol = (actionRecord) => {
  if (!actionRecord) return '?';
  const { action, amount, call_amount, pot_before_bet, bet_being_raised, street } = actionRecord;

  if (action === 'fold') return 'F';
  if (action === 'check') return 'X';
  if (action === 'call') {
    if (street === 'preflop') {
      const bb = call_amount / BIG_BLIND;
      return `C ${bb % 1 === 0 ? bb : bb.toFixed(1)}BB`;
    }
    const pct = pot_before_bet > 0 ? Math.round((call_amount / pot_before_bet) * 100) : 0;
    return `C ${pct}%`;
  }
  if (action === 'bet') {
    const pct = pot_before_bet > 0 ? Math.round((amount / pot_before_bet) * 100) : 0;
    return `B ${pct}%`;
  }
  if (action === 'raise') {
    if (street === 'preflop') {
      const bb = Math.round(amount / BIG_BLIND);
      return `R ${bb}BB`;
    }
    if (bet_being_raised && bet_being_raised > 0) {
      const mult = amount / bet_being_raised;
      return `R ${mult % 1 === 0 ? mult : mult.toFixed(1)}x`;
    }
    const pct = pot_before_bet > 0 ? Math.round((amount / pot_before_bet) * 100) : 0;
    return `R ${pct}%`;
  }
  if (action === 'allin') return 'A';
  return action;
};

// PioSolver hand strength categories (best to worst)
const HAND_STRENGTH_CONFIG = {
  straight_flush: { label: 'Str Flush', color: '#9b59b6', order: 0 },
  quads: { label: 'Quads', color: '#8e44ad', order: 1 },
  top_fullhouse: { label: 'Top FH', color: '#e74c3c', order: 2 },
  full_house: { label: 'Full House', color: '#c0392b', order: 3 },
  flush: { label: 'Flush', color: '#3498db', order: 4 },
  straight: { label: 'Straight', color: '#2980b9', order: 5 },
  trips: { label: 'Trips', color: '#27ae60', order: 6 },
  weak_trips: { label: 'Weak Trips', color: '#2ecc71', order: 7 },
  two_pair: { label: 'Two Pair', color: '#f39c12', order: 8 },
  low_two_pair: { label: 'Low 2P', color: '#e67e22', order: 9 },
  overpair: { label: 'Overpair', color: '#d35400', order: 10 },
  top_pair: { label: 'Top Pair', color: '#e74c3c', order: 11 },
  pp_above_tp: { label: 'PP > TP', color: '#c0392b', order: 12 },
  pp_below_tp: { label: 'PP < TP', color: '#95a5a6', order: 13 },
  middle_pair: { label: 'Mid Pair', color: '#7f8c8d', order: 14 },
  weak_pair: { label: 'Weak Pair', color: '#6c7a89', order: 15 },
  ace_high: { label: 'Ace High', color: '#5d6d7e', order: 16 },
  king_high: { label: 'King High', color: '#4d5656', order: 17 },
  nothing: { label: 'Nothing', color: '#34495e', order: 18 },
};

// PioSolver draw categories
const DRAW_CONFIG = {
  combo_draw: { label: 'Combo Draw', color: '#9b59b6', order: 0 },
  flush_draw: { label: 'Flush Draw', color: '#3498db', order: 1 },
  '8out_straight_draw': { label: 'OESD', color: '#27ae60', order: 2 },
  '4out_straight_draw': { label: 'Gutshot', color: '#2ecc71', order: 3 },
  no_draw: { label: 'No Draw', color: '#7f8c8d', order: 4 },
};

// Range Composition display component
function RangeComposition({ composition, showCombos, onToggleShowCombos }) {
  if (!composition) return null;

  const { hand_strength, draws, total_combos } = composition;

  // Check if we have the new format (hand_strength/draws)
  const hasNewFormat = hand_strength || draws;
  if (!hasNewFormat) return null;

  // Sort hand strength categories by order (strongest first)
  const sortedHandStrength = Object.entries(hand_strength || {})
    .filter(([_, val]) => val.percent > 0.5)  // Only show categories with >0.5%
    .sort((a, b) => {
      const orderA = HAND_STRENGTH_CONFIG[a[0]]?.order ?? 99;
      const orderB = HAND_STRENGTH_CONFIG[b[0]]?.order ?? 99;
      return orderA - orderB;
    });

  // Sort draw categories by order (strongest first)
  const sortedDraws = Object.entries(draws || {})
    .filter(([name, val]) => val.percent > 0.5 && name !== 'no_draw')  // Hide no_draw
    .sort((a, b) => {
      const orderA = DRAW_CONFIG[a[0]]?.order ?? 99;
      const orderB = DRAW_CONFIG[b[0]]?.order ?? 99;
      return orderA - orderB;
    });

  const formatValue = (val) => showCombos ? val.combos : `${val.percent}%`;

  return (
    <div className="range-composition">
      <div className="composition-header">
        <span>Range Breakdown</span>
        <div className="composition-toggle">
          <span className={!showCombos ? 'active' : ''}>%</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showCombos}
              onChange={() => onToggleShowCombos?.(!showCombos)}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className={showCombos ? 'active' : ''}>#</span>
        </div>
      </div>
      <div className="total-combos-row">{total_combos} combos total</div>

      {/* Hand Strength Section */}
      {sortedHandStrength.length > 0 && (
        <div className="composition-section">
          <div className="section-label">Made Hands</div>
          {sortedHandStrength.map(([category, val]) => {
            const config = HAND_STRENGTH_CONFIG[category] || { label: category, color: '#95a5a6' };
            return (
              <div key={category} className="composition-row">
                <span className="cat-label">{config.label}</span>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{ width: `${val.percent}%`, backgroundColor: config.color }}
                  />
                </div>
                <span className="cat-percent">{formatValue(val)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Draws Section */}
      {sortedDraws.length > 0 && (
        <div className="composition-section">
          <div className="section-label">Draws</div>
          {sortedDraws.map(([category, val]) => {
            const config = DRAW_CONFIG[category] || { label: category, color: '#95a5a6' };
            return (
              <div key={category} className="composition-row">
                <span className="cat-label">{config.label}</span>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{ width: `${val.percent}%`, backgroundColor: config.color }}
                  />
                </div>
                <span className="cat-percent">{formatValue(val)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StrategyGrid({ strategyData, strategyHistory = [], selectedIndex = null, onSelectIndex, rangeComposition }) {
  const [showCombos, setShowCombos] = useState(false);

  // Determine which strategy to display
  const displayStrategy = selectedIndex !== null && strategyHistory?.[selectedIndex]?.strategy
    ? strategyHistory[selectedIndex].strategy
    : strategyData;

  // Determine which range composition to display
  const displayComposition = selectedIndex !== null && strategyHistory?.[selectedIndex]?.range_composition
    ? strategyHistory[selectedIndex].range_composition
    : rangeComposition;

  if (!displayStrategy || !displayStrategy.grid) {
    return (
      <div className="strategy-grid-placeholder">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Strategy available from flop
        </p>
      </div>
    );
  }

  const { grid, actions, is_check, pot, current_bet } = displayStrategy;
  const isCheck = is_check !== false; // Default to true if not specified
  const potValue = pot || 0;
  const currentBet = current_bet || 0;

  // Build bet color map based on available actions at this node
  const betColorMap = buildBetColorMap(actions || []);

  // Build mapping from action strings to actual amounts (for tooltips)
  const actionAmountMap = {};
  (actions || []).forEach(a => {
    if (typeof a === 'object' && a.action && a.amount != null) {
      actionAmountMap[a.action] = a.amount;
    }
  });

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
    // Order: bets (largest to smallest), call/check, fold
    const getActionOrder = (action) => {
      if (action.startsWith('b')) {
        // Negative size so larger bets sort first
        return -(parseInt(action.substring(1)) || 0);
      }
      if (action === 'c') return 1000;  // Call/check after bets
      if (action === 'f') return 2000;  // Fold last
      return 1500;  // Unknown actions
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
      .map(([action, freq]) => {
        const actualAmount = actionAmountMap[action] ?? null;
        return `${getActionLabel(action, isCheck, potValue, currentBet, actualAmount)}: ${(freq * 100).toFixed(0)}%`;
      });

    return `${handLabel}\n${parts.join('\n')}`;
  };

  // Filter strategy history to only show entries with actions (villain has acted)
  const completedHistory = strategyHistory.filter(entry => entry.action !== null);

  // Group actions by street
  const groupedByStreet = completedHistory.reduce((acc, entry, index) => {
    const street = entry.street || 'flop';
    if (!acc[street]) acc[street] = [];
    acc[street].push({ entry, index });
    return acc;
  }, {});

  const streetOrder = ['flop', 'turn', 'river'];
  const streetLabels = { flop: 'F:', turn: 'T:', river: 'R:' };

  return (
    <div className="strategy-grid">
      {/* Action History */}
      {completedHistory.length > 0 && (
        <div className="strategy-action-history">
          {streetOrder.map(street => {
            const streetActions = groupedByStreet[street];
            if (!streetActions || streetActions.length === 0) return null;
            return (
              <div key={street} className="action-street">
                <span className="street-label">{streetLabels[street]}</span>
                {streetActions.map(({ entry, index }) => {
                  const originalIndex = strategyHistory.findIndex(e => e === entry);
                  const isSelected = selectedIndex === originalIndex;
                  return (
                    <span
                      key={index}
                      className={`action-symbol action-${entry.action?.action} ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectIndex?.(isSelected ? null : originalIndex)}
                      title={`${entry.street}: ${entry.node}`}
                    >
                      {getActionSymbol(entry.action)}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Range Composition */}
      <RangeComposition composition={displayComposition} showCombos={showCombos} onToggleShowCombos={setShowCombos} />

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
          {actions.map((actionObj) => {
            const actionStr = typeof actionObj === 'object' ? actionObj.action : actionObj;
            const actualAmount = typeof actionObj === 'object' ? actionObj.amount : null;
            return (
              <div key={actionStr} className="legend-item">
                <div
                  className="legend-color"
                  style={{ backgroundColor: getActionColor(actionStr, betColorMap) }}
                />
                <span>{getActionLabel(actionStr, isCheck, potValue, currentBet, actualAmount)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StrategyGrid;
