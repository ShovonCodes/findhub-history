# Third-party code

This package implements the Google Find Hub protocol.
It is a trimmed-down adaptation of [GoogleFindMyTools / google-find-hub-sync](https://github.com/traccar/google-find-hub-sync) by Leon Böttger, licensed under the GNU General Public License v3.0 (see `LICENSE` in this folder).
Only the code needed to sign in, list devices, request locations and decrypt them is kept.

`fcm/` is [firebase-messaging](https://github.com/sdb9696/firebase-messaging) by sdb9696, licensed under the MIT License (see the header of `fcm/__init__.py`).
It carries two fixes: Android app identification headers for Firebase installations, and parsing of the `crypto-key` push header.

`proto/*_pb2.py` are generated from the `.proto` files next to them:

```bash
python -m grpc_tools.protoc -I server --python_out=server --pyi_out=server \
  server/findhub/google/proto/common.proto server/findhub/google/proto/device_update.proto
```

Use a `grpcio-tools` release whose bundled protobuf matches the `protobuf` range in `pyproject.toml` (for example `grpcio-tools==1.76.*` for protobuf 6).
