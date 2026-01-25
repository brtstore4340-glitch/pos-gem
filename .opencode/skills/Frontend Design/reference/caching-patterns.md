# Streamlit Caching Patterns

**Quick reference for caching decorators in Streamlit components**

## Decision Tree

```
Is this function...?
├─ Initializing a client/connection? → @st.cache_resource
├─ Loading/transforming data? → @st.cache_data(ttl=...)
├─ Handling user events? → No caching
└─ Rendering UI? → No caching (internal helpers may cache)
```

## Common Patterns

### Pattern 1: Data Loading

```python
@st.cache_data(ttl=300)
def load_lead_analytics(lead_id: str) -> dict:
    """Load lead analytics from API or database."""
    return api.fetch_analytics(lead_id)
```

### Pattern 2: Resource Initialization

```python
@st.cache_resource
def get_redis_client():
    """Get Redis client (singleton)."""
    return redis.Redis(host='localhost', port=6379)
```

### Pattern 3: Expensive Calculations

```python
@st.cache_data(ttl=300)
def calculate_lead_score(lead_data: dict) -> float:
    """Calculate lead score with ML model."""
    return model.predict(lead_data)
```

### Pattern 4: Event Handlers (No Cache)

```python
def handle_button_click():
    """Handle button click event - never cache."""
    st.session_state.clicked = True
    st.rerun()
```

## TTL Selection Guide

| Data Type | TTL         | Example                |
| --------- | ----------- | ---------------------- |
| Real-time | 30-60s      | Live market prices     |
| Frequent  | 300s (5min) | Lead scores, analytics |
| Stable    | 3600s (1h)  | Property details       |
| Static    | No TTL      | Configuration data     |

## Component Template

```python
import streamlit as st

# Resource initialization (singleton)
@st.cache_resource
def get_api_client():
    return APIClient(api_key=st.secrets["API_KEY"])

# Data loading (with TTL)
@st.cache_data(ttl=300)
def load_component_data(filters: dict) -> dict:
    client = get_api_client()
    return client.fetch_data(filters)

# Component render (no cache)
def render_my_component():
    """Render component - called on every rerun."""

    # Session state for user interactions
    if 'selected_id' not in st.session_state:
        st.session_state.selected_id = None

    # Load cached data
    data = load_component_data({"status": "active"})

    # Render UI
    st.dataframe(data)

    # Event handler (no cache)
    if st.button("Refresh"):
        load_component_data.clear()
        st.rerun()
```

## Validation & Auto-Fix

**Check for missing caching**:

```bash
python .claude/scripts/validate-caching.py components/my_component.py
```

**Auto-add decorators**:

```bash
python .claude/scripts/add-caching-decorators.py components/my_component.py
```

## Performance Impact

- **Without caching**: 2-4s component load
- **With caching**: 0.8-1.6s component load
- **Improvement**: 40-60% faster

## See Also

- Full guide: `.claude/CACHING_STRATEGY_GUIDE.md`
- Hook: `.claude/hooks/PreToolUse-caching-enforcer.md`
- Project patterns: `CLAUDE.md` (Streamlit Component Patterns)
