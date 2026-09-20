# BazaarMind stall/location backend integration

In `backend/server.py`:

1. Add this import with the other service imports:
```python
import stall_routes
```

2. Immediately before:
```python
app.include_router(api)
```
add:
```python
api.include_router(stall_routes.build_router(db))
```

No existing route needs to be removed.

The existing `SignalCreate.vendorId` field already accepts the vendor identity sent by the new Vendor page. The new location layer uses the same `vendorId` when returning vendor-specific signals to shoppers.
