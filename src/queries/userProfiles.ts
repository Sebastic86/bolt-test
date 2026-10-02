import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as userProfileService from '../services/userProfileService';

export const userProfileKeys = {
  adminUserList: ['admin', 'users'] as const,
  adminProfiles: ['admin', 'userProfiles'] as const,
};

/** Admin-only: lists every auth.users row via the admin_list_users RPC. */
export function useAdminUserListQuery() {
  return useQuery({
    queryKey: userProfileKeys.adminUserList,
    queryFn: userProfileService.fetchAllUsersAsAdmin,
  });
}

/** Admin-only: every user_profiles row, merged with the above by id to know each user's role. */
export function useAdminUserProfilesQuery() {
  return useQuery({
    queryKey: userProfileKeys.adminProfiles,
    queryFn: userProfileService.fetchAllUserProfilesAsAdmin,
  });
}

export function useCreateUserProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'normal' }) =>
      userProfileService.createUserProfile(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userProfileKeys.adminProfiles }),
  });
}

export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'normal' }) =>
      userProfileService.updateUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userProfileKeys.adminProfiles }),
  });
}

export function useDeleteUserProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => userProfileService.deleteUserProfile(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userProfileKeys.adminProfiles }),
  });
}
