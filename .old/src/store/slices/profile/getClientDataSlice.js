import  {createSlice, createAsyncThunk } from "@reduxjs/toolkit"; 
import getClientData from "@/services/clientUser/getClientData";
import { updateClientDataAsyncThunk } from "./updateProfileSlice";
export const getClientDataAsyncThunk = createAsyncThunk(
  'profile/getClientDataAsync',
  async (userId, { rejectWithValue }) => {
    try {
      const clientData = await getClientData(userId);
      return clientData;
    } catch (error) {
      console.error('Error fetching client data:', error);
      return rejectWithValue(error.message || 'Xatolik yuz berdi');
    }
  }
);

const initialState = {
  clientInfo: null,
  loading: false,
  error: null,
}

const getClientDataSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getClientDataAsyncThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getClientDataAsyncThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.clientInfo = action.payload;
      })
      .addCase(getClientDataAsyncThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateClientDataAsyncThunk.fulfilled, (state, action) => {
        if (state.clientInfo) {
          state.clientInfo = {
            ...state.clientInfo,
            ...action.meta.arg.updatedFields 
          };
        }
      });;
  }
});

export default getClientDataSlice.reducer;