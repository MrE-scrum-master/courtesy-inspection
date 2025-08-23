// DataTable Component - Sortable, filterable table for iPad optimization
import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from '../constants/theme';
import { getDeviceInfo, getTouchTargetSize } from '../utils/responsive';
import { Button } from './Button';
import { Card } from './Card';

export interface DataTableColumn<T = any> {
  key: string;
  title: string;
  dataKey: keyof T;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, item: T, index: number) => React.ReactNode;
  headerRender?: () => React.ReactNode;
  filterType?: 'text' | 'select' | 'date' | 'number';
  filterOptions?: Array<{ label: string; value: any }>;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  error?: string | null;
  
  // Sorting
  defaultSortKey?: string;
  defaultSortOrder?: 'asc' | 'desc';
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  
  // Filtering
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onFilter?: (filters: Record<string, any>) => void;
  
  // Selection
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedRows: string[]) => void;
  rowKey?: keyof T | ((item: T) => string);
  
  // Pagination
  paginationEnabled?: boolean;
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  
  // Actions
  rowActions?: Array<{
    label: string;
    icon?: string;
    color?: string;
    onPress: (item: T) => void;
    visible?: (item: T) => boolean;
  }>;
  bulkActions?: Array<{
    label: string;
    icon?: string;
    color?: string;
    onPress: (selectedItems: T[]) => void;
    disabled?: boolean;
  }>;
  
  // Styling
  striped?: boolean;
  compact?: boolean;
  stickyHeader?: boolean;
  maxHeight?: number;
  
  // Callbacks
  onRowPress?: (item: T, index: number) => void;
  onRowLongPress?: (item: T, index: number) => void;
  
  // Empty state
  emptyMessage?: string;
  emptyIcon?: string;
  
  // Accessibility
  accessibilityLabel?: string;
  testID?: string;
}

export function DataTable<T = any>({
  data,
  columns,
  loading = false,
  error = null,
  defaultSortKey,
  defaultSortOrder = 'asc',
  onSort,
  searchable = false,
  searchPlaceholder = 'Search...',
  onSearch,
  onFilter,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  rowKey = 'id',
  paginationEnabled = false,
  currentPage = 1,
  totalPages = 1,
  pageSize = 20,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  rowActions = [],
  bulkActions = [],
  striped = true,
  compact = false,
  stickyHeader = true,
  maxHeight,
  onRowPress,
  onRowLongPress,
  emptyMessage = 'No data available',
  emptyIcon = 'document-outline',
  accessibilityLabel = 'Data table',
  testID = 'data-table',
}: DataTableProps<T>) {
  const deviceInfo = getDeviceInfo();
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder);
  const [searchQuery, setSearchQuery] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, any>>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // Calculate responsive column widths
  const calculatedColumns = useMemo(() => {
    const totalFixedWidth = columns
      .filter(col => col.width && typeof col.width === 'number')
      .reduce((sum, col) => sum + (col.width as number), 0);
    
    const flexColumns = columns.filter(col => !col.width || typeof col.width === 'string');
    const flexWidth = flexColumns.length > 0 ? `${100 / flexColumns.length}%` : '100%';
    
    return columns.map(col => ({
      ...col,
      calculatedWidth: col.width || flexWidth,
    }));
  }, [columns]);
  
  // Get row key
  const getRowKey = useCallback((item: T): string => {
    if (typeof rowKey === 'function') {
      return rowKey(item);
    }
    return String(item[rowKey]);
  }, [rowKey]);
  
  // Handle sorting
  const handleSort = useCallback((key: string) => {
    const newOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortOrder(newOrder);
    onSort?.(key, newOrder);
  }, [sortKey, sortOrder, onSort]);
  
  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  }, [onSearch]);
  
  // Handle column filter
  const handleColumnFilter = useCallback((columnKey: string, value: any) => {
    const newFilters = { ...columnFilters, [columnKey]: value };
    setColumnFilters(newFilters);
    onFilter?.(newFilters);
  }, [columnFilters, onFilter]);
  
  // Handle row selection
  const handleRowSelection = useCallback((item: T) => {
    const key = getRowKey(item);
    const isSelected = selectedRows.includes(key);
    const newSelection = isSelected
      ? selectedRows.filter(id => id !== key)
      : [...selectedRows, key];
    onSelectionChange?.(newSelection);
  }, [selectedRows, onSelectionChange, getRowKey]);
  
  // Handle select all
  const handleSelectAll = useCallback(() => {
    const allKeys = data.map(getRowKey);
    const allSelected = allKeys.every(key => selectedRows.includes(key));
    const newSelection = allSelected ? [] : allKeys;
    onSelectionChange?.(newSelection);
  }, [data, selectedRows, onSelectionChange, getRowKey]);
  
  // Filter data locally if no external filtering
  const filteredData = useMemo(() => {
    if (onSearch || onFilter) return data; // External filtering
    
    let filtered = [...data];
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(item =>
        columns.some(col => {
          const value = item[col.dataKey];
          return value && 
            String(value).toLowerCase().includes(searchQuery.toLowerCase());
        })
      );
    }
    
    // Apply column filters
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        filtered = filtered.filter(item => {
          const itemValue = item[key as keyof T];
          if (typeof value === 'string') {
            return String(itemValue).toLowerCase().includes(value.toLowerCase());
          }
          return itemValue === value;
        });
      }
    });
    
    return filtered;
  }, [data, searchQuery, columnFilters, columns, onSearch, onFilter]);
  
  // Sort data locally if no external sorting
  const sortedData = useMemo(() => {
    if (onSort || !sortKey) return filteredData; // External sorting
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortKey as keyof T];
      const bValue = b[sortKey as keyof T];
      
      if (aValue === bValue) return 0;
      
      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortOrder, onSort]);
  
  // Get selected items
  const selectedItems = useMemo(() => {
    return data.filter(item => selectedRows.includes(getRowKey(item)));
  }, [data, selectedRows, getRowKey]);
  
  // Render table header
  const renderHeader = () => (
    <View style={[styles.headerRow, stickyHeader && styles.stickyHeader]}>
      {selectable && (
        <View style={[styles.headerCell, styles.checkboxCell]}>
          <TouchableOpacity
            onPress={handleSelectAll}
            style={styles.checkbox}
            accessibilityRole="checkbox"
            accessibilityState={{ 
              checked: data.length > 0 && selectedRows.length === data.length 
            }}
          >
            <Ionicons
              name={
                selectedRows.length === data.length && data.length > 0
                  ? 'checkbox'
                  : selectedRows.length > 0
                  ? 'checkbox-outline' // Indeterminate state
                  : 'square-outline'
              }
              size={20}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>
      )}
      
      {calculatedColumns.map((column) => (
        <View
          key={column.key}
          style={[
            styles.headerCell,
            { width: column.calculatedWidth },
            column.align && { alignItems: column.align },
          ]}
        >
          {column.headerRender ? (
            column.headerRender()
          ) : (
            <TouchableOpacity
              onPress={() => column.sortable && handleSort(column.key)}
              style={styles.headerButton}
              disabled={!column.sortable}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${column.title}`}
            >
              <Text style={styles.headerText}>{column.title}</Text>
              {column.sortable && (
                <Ionicons
                  name={
                    sortKey === column.key
                      ? sortOrder === 'asc'
                        ? 'chevron-up'
                        : 'chevron-down'
                      : 'chevron-expand'
                  }
                  size={14}
                  color={sortKey === column.key ? COLORS.primary : COLORS.gray[400]}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      ))}
      
      {rowActions.length > 0 && (
        <View style={[styles.headerCell, styles.actionsCell]}>
          <Text style={styles.headerText}>Actions</Text>
        </View>
      )}
    </View>
  );
  
  // Render table row
  const renderRow = ({ item, index }: { item: T; index: number }) => {
    const isSelected = selectedRows.includes(getRowKey(item));
    const isEven = index % 2 === 0;
    
    return (
      <TouchableOpacity
        style={[
          styles.dataRow,
          striped && !isEven && styles.stripedRow,
          isSelected && styles.selectedRow,
          compact && styles.compactRow,
        ]}
        onPress={() => onRowPress?.(item, index)}
        onLongPress={() => onRowLongPress?.(item, index)}
        accessibilityRole="button"
        accessibilityLabel={`Table row ${index + 1}`}
        testID={`${testID}-row-${index}`}
      >
        {selectable && (
          <View style={[styles.dataCell, styles.checkboxCell]}>
            <TouchableOpacity
              onPress={() => handleRowSelection(item)}
              style={styles.checkbox}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
            >
              <Ionicons
                name={isSelected ? 'checkbox' : 'square-outline'}
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        )}
        
        {calculatedColumns.map((column) => (
          <View
            key={column.key}
            style={[
              styles.dataCell,
              { width: column.calculatedWidth },
              column.align && { alignItems: column.align },
            ]}
          >
            {column.render ? (
              column.render(item[column.dataKey], item, index)
            ) : (
              <Text 
                style={styles.cellText}
                numberOfLines={compact ? 1 : 2}
                ellipsizeMode="tail"
              >
                {String(item[column.dataKey] || '')}
              </Text>
            )}
          </View>
        ))}
        
        {rowActions.length > 0 && (
          <View style={[styles.dataCell, styles.actionsCell]}>
            <View style={styles.rowActions}>
              {rowActions
                .filter(action => !action.visible || action.visible(item))
                .map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    onPress={() => action.onPress(item)}
                    style={[
                      styles.actionButton,
                      { backgroundColor: action.color || COLORS.gray[200] }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                  >
                    {action.icon && (
                      <Ionicons
                        name={action.icon as any}
                        size={16}
                        color={COLORS.white}
                      />
                    )}
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };
  
  // Render column filters
  const renderFilters = () => {
    if (!showFilters) return null;
    
    return (
      <View style={styles.filtersRow}>
        {selectable && <View style={styles.checkboxCell} />}
        
        {calculatedColumns.map((column) => (
          <View
            key={`filter-${column.key}`}
            style={[styles.filterCell, { width: column.calculatedWidth }]}
          >
            {column.filterable && (
              <TextInput
                style={styles.filterInput}
                placeholder={`Filter ${column.title}`}
                value={columnFilters[column.key] || ''}
                onChangeText={(value) => handleColumnFilter(column.key, value)}
                placeholderTextColor={COLORS.gray[400]}
              />
            )}
          </View>
        ))}
        
        {rowActions.length > 0 && <View style={styles.actionsCell} />}
      </View>
    );
  };
  
  // Render pagination
  const renderPagination = () => {
    if (!paginationEnabled) return null;
    
    return (
      <View style={styles.paginationContainer}>
        <View style={styles.paginationInfo}>
          <Text style={styles.paginationText}>
            {totalItems > 0 
              ? `${((currentPage - 1) * pageSize) + 1}-${Math.min(currentPage * pageSize, totalItems)} of ${totalItems}`
              : '0 items'
            }
          </Text>
        </View>
        
        <View style={styles.paginationControls}>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage <= 1}
            style={styles.paginationButton}
          >
            <Ionicons name="chevron-back" size={16} color={COLORS.text.primary} />
          </Button>
          
          <Text style={styles.pageNumber}>
            {currentPage} of {totalPages}
          </Text>
          
          <Button
            variant="secondary"
            size="sm"
            onPress={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={styles.paginationButton}
          >
            <Ionicons name="chevron-forward" size={16} color={COLORS.text.primary} />
          </Button>
        </View>
      </View>
    );
  };
  
  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name={emptyIcon as any} size={48} color={COLORS.gray[400]} />
      <Text style={styles.emptyText}>{emptyMessage}</Text>
    </View>
  );
  
  // Render loading state
  const renderLoadingState = () => (
    <View style={styles.loadingState}>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
  
  // Render error state
  const renderErrorState = () => (
    <View style={styles.errorState}>
      <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );
  
  return (
    <Card style={styles.container} testID={testID}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        {searchable && (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.gray[400]} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChangeText={handleSearch}
              placeholderTextColor={COLORS.gray[400]}
            />
          </View>
        )}
        
        <View style={styles.toolbarActions}>
          {columns.some(col => col.filterable) && (
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setShowFilters(!showFilters)}
              style={styles.toolbarButton}
            >
              <Ionicons 
                name="filter" 
                size={16} 
                color={showFilters ? COLORS.primary : COLORS.gray[600]} 
              />
            </Button>
          )}
          
          {bulkActions.length > 0 && selectedRows.length > 0 && (
            <View style={styles.bulkActions}>
              {bulkActions.map((action) => (
                <Button
                  key={action.label}
                  variant="secondary"
                  size="sm"
                  onPress={() => action.onPress(selectedItems)}
                  disabled={action.disabled}
                  style={[
                    styles.toolbarButton,
                    { backgroundColor: action.color || COLORS.primary }
                  ]}
                >
                  {action.icon && (
                    <Ionicons name={action.icon as any} size={16} color={COLORS.white} />
                  )}
                  <Text style={styles.bulkActionText}>{action.label}</Text>
                </Button>
              ))}
            </View>
          )}
        </View>
      </View>
      
      {/* Table */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
        contentContainerStyle={styles.tableContainer}
      >
        <View style={styles.table}>
          {renderHeader()}
          {renderFilters()}
          
          <View style={[styles.tableBody, maxHeight && { maxHeight }]}>
            {loading ? (
              renderLoadingState()
            ) : error ? (
              renderErrorState()
            ) : sortedData.length === 0 ? (
              renderEmptyState()
            ) : (
              <FlatList
                data={sortedData}
                keyExtractor={getRowKey}
                renderItem={renderRow}
                showsVerticalScrollIndicator={true}
                accessibilityLabel={accessibilityLabel}
              />
            )}
          </View>
        </View>
      </ScrollView>
      
      {renderPagination()}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    flex: 1,
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    marginLeft: SPACING.sm,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  toolbarButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  bulkActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  bulkActionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.white,
    marginLeft: SPACING.sm,
  },
  horizontalScroll: {
    flex: 1,
  },
  tableContainer: {
    minWidth: '100%',
  },
  table: {
    flex: 1,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray[50],
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border.primary,
    minHeight: getTouchTargetSize('md'),
  },
  headerCell: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border.primary,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: getTouchTargetSize('sm'),
  },
  headerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text.primary,
  },
  filtersRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background.tertiary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  filterCell: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRightWidth: 1,
    borderRightColor: COLORS.border.primary,
  },
  filterInput: {
    backgroundColor: COLORS.white,
    borderRadius: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  tableBody: {
    flex: 1,
  },
  dataRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
    minHeight: getTouchTargetSize('md'),
  },
  stripedRow: {
    backgroundColor: COLORS.gray[25],
  },
  selectedRow: {
    backgroundColor: COLORS.primary + '10',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  compactRow: {
    minHeight: getTouchTargetSize('sm'),
  },
  dataCell: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border.primary,
  },
  cellText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
  },
  checkboxCell: {
    width: 48,
    alignItems: 'center',
  },
  checkbox: {
    padding: SPACING.sm,
  },
  actionsCell: {
    width: 100,
    alignItems: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['4xl'],
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
  },
  loadingText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.text.secondary,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.error,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background.secondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.primary,
  },
  paginationInfo: {
    flex: 1,
  },
  paginationText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  paginationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  pageNumber: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
  },
});