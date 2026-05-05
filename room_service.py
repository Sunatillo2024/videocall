from typing import Dict, Set, List
import logging

logger = logging.getLogger(__name__)


class RoomService:
    def __init__(self):
        # { room_id: set of user_ids }
        self.rooms: Dict[str, Set[str]] = {}

    def join_room(self, room_id: str, user_id: str):
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(user_id)
        logger.info(f"Room {room_id} users: {self.rooms[room_id]}")

    def leave_room(self, room_id: str, user_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].discard(user_id)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    def get_peers(self, room_id: str, exclude_user: str) -> List[str]:
        if room_id not in self.rooms:
            return []
        return [uid for uid in self.rooms[room_id] if uid != exclude_user]

    def get_room_count(self) -> int:
        return len(self.rooms)

    def get_users_in_room(self, room_id: str) -> List[str]:
        return list(self.rooms.get(room_id, set()))
