import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Send, Upload, Loader2, Building } from 'lucide-react';

interface FeedbackForm {
  description: string;
  category: 'data-missing' | 'data-incorrect' | 'both' | 'other';
  appliesTo: {
    marketRents: boolean;
    inPlaceRents: boolean;
    units: boolean;
    floorplans: boolean;
    sf: boolean;
    charges: boolean;
  };
  file?: File;
  reprocessFile: boolean;
  // Manual input fields for when URL parameters are missing
  redIQUsername: string;
  email: string;
  dealName: string;
  dealCounter: string;
}

// Helper function to convert File object to base64 string
const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // The result includes the data URL prefix, so we remove that part
      if (reader.result && typeof reader.result === 'string') {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        resolve('');
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
  });
};

function App() {
  const [dealInfo, setDealInfo] = useState<string | null>(null);
  const [missingVidParams, setMissingVidParams] = useState(false);
  const [missingDealParams, setMissingDealParams] = useState(false);
  const [form, setForm] = useState<FeedbackForm>({
    description: '',
    category: 'data-missing',
    appliesTo: {
      marketRents: false,
      inPlaceRents: false,
      units: false,
      floorplans: false,
      sf: false,
      charges: false,
    },
    reprocessFile: false,
    redIQUsername: '',
    email: '',
    dealName: '',
    dealCounter: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract deal information from URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dealParam = urlParams.get('deal');
    const vidParam = urlParams.get('vid');
    
    // Check if vid parameter is missing, blank, or placeholder
    if (!vidParam || vidParam.trim() === '' || vidParam === '[vid_value]') {
      setMissingVidParams(true);
    }
    
    // Check if deal parameter is missing or empty
    if (!dealParam || dealParam.trim() === '') {
      setMissingDealParams(true);
    } else {
      // URL decode the deal parameter
      const decodedDeal = decodeURIComponent(dealParam);
      setDealInfo(decodedDeal);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm(prev => ({ ...prev, file, reprocessFile: true }));
    }
  };

  const handleCheckboxChange = (field: keyof FeedbackForm['appliesTo']) => {
    setForm(prev => ({
      ...prev,
      appliesTo: {
        ...prev.appliesTo,
        [field]: !prev.appliesTo[field]
      }
    }));
  };

  const handleToggleReprocess = () => {
    setForm(prev => ({
      ...prev,
      reprocessFile: !prev.reprocessFile
    }));
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0]; // Just use the first file if multiple are dropped
      setForm(prev => ({ ...prev, file, reprocessFile: true }));
      
      // If we have a file input ref, update its files
      if (fileInputRef.current) {
        // Create a new DataTransfer object
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        // Set the file input's files
        fileInputRef.current.files = dataTransfer.files;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    // Check if a file is attached
    if (!form.file) {
      setError("Please attach a source file for debugging");
      return;
    }
    
    // Validate required manual input fields (only when reprocessFile is checked)
    if (form.reprocessFile) {
      if (missingVidParams && (!form.redIQUsername.trim() || !form.email.trim())) {
        setError("Please provide redIQ Username and Email address");
        return;
      }
      
      if (missingDealParams && (!form.dealName.trim() || !form.dealCounter.trim())) {
        setError("Please provide Deal Name and Deal Counter Number");
        return;
      }
    }
    
    setIsSubmitting(true);
  
    try {
      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const urlParamsObject: Record<string, string> = {};
      urlParams.forEach((value, key) => {
        urlParamsObject[key] = value;
      });
  
      // Prepare file data
      // Define the file data type
      interface FileData {
        name: string;
        type: string;
        size: number;
        content: string;
      }
      
      let fileData: FileData | null = null;
      if (form.file) {
        // Convert file to base64
        const base64File = await convertFileToBase64(form.file);
        fileData = {
          name: form.file.name,
          type: form.file.type,
          size: form.file.size,
          content: base64File
        };
      }
  
      // Create the payload
      const payload = {
        formData: {
          description: form.description,
          category: form.category,
          appliesTo: form.appliesTo,
          reprocessFile: form.reprocessFile,
          // Include manual input fields when URL parameters are missing AND reprocessFile is checked
          redIQUsername: (missingVidParams && form.reprocessFile) ? form.redIQUsername : null,
          email: (missingVidParams && form.reprocessFile) ? form.email : null,
          dealName: (missingDealParams && form.reprocessFile) ? form.dealName : null,
          dealCounter: (missingDealParams && form.reprocessFile) ? form.dealCounter : null
        },
        fileAttachment: fileData,
        urlParameters: urlParamsObject,
        submittedAt: new Date().toISOString(),
        userAgent: navigator.userAgent
      };
  
      // PowerAutomate endpoint URL
      const powerAutomateEndpoint = "https://prod-13.westus.logic.azure.com:443/workflows/721509f5a7e4467bac8e771ee033257a/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=X1SGNnstEHWJ3mt3JqmprKBrtiAO3VjM0V9ubV6xpe8";
  
      // Send the data to PowerAutomate
      const response = await fetch(powerAutomateEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
  
      if (!response.ok) {
        throw new Error(`Failed to submit feedback: ${response.status} ${response.statusText}`);
      }
  
      // Check if there's actually content in the response
      const responseText = await response.text();
      let responseData;
      
      if (responseText && responseText.trim() !== '') {
        try {
          responseData = JSON.parse(responseText);
          console.log('Submission successful:', responseData);
        } catch (parseError) {
          console.log('Received non-JSON response but submission was successful. Error:', parseError);
        }
      } else {
        console.log('Received empty response but submission was successful');
      }
  
      // Reset form and show success message
      setSuccess(true);
      setForm({
        description: '',
        category: 'data-missing',
        appliesTo: {
          marketRents: false,
          inPlaceRents: false,
          units: false,
          floorplans: false,
          sf: false,
          charges: false,
        },
        reprocessFile: false,
        redIQUsername: '',
        email: '',
        dealName: '',
        dealCounter: ''
      });
    } catch (err) {
      console.error('Error submitting form:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Report Data Extraction Issue
          </h1>
          <p className="text-gray-600">
            Help us improve by reporting any data extraction errors you encounter
          </p>
        </div>

        {/* Deal information display - shown when deal param is present */}
        {dealInfo && (
          <div className="mb-6 bg-blue-100 border border-blue-200 rounded-lg p-4 flex items-start">
            <Building className="flex-shrink-0 h-6 w-6 text-blue-600 mt-0.5 mr-2" />
            <div>
              <h2 className="text-lg font-semibold text-blue-800">Reporting Issue for:</h2>
              <p className="text-blue-700 text-xl">
                {dealInfo}
              </p>
            </div>
          </div>
        )}


        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-green-800 mb-2">
              Thank you for your feedback!
            </h2>
            <p className="text-green-700">
              We'll review your report and work on resolving the issue.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Submit Another Report
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow-lg rounded-xl p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Category
                </label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="data-missing"
                      name="category"
                      value="data-missing"
                      checked={form.category === 'data-missing'}
                      onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value as FeedbackForm['category'] }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="data-missing" className="ml-3 text-sm text-gray-700">
                      Data Missing
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="data-incorrect"
                      name="category"
                      value="data-incorrect"
                      checked={form.category === 'data-incorrect'}
                      onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value as FeedbackForm['category'] }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="data-incorrect" className="ml-3 text-sm text-gray-700">
                      Data Captured Incorrectly
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="both"
                      name="category"
                      value="both"
                      checked={form.category === 'both'}
                      onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value as FeedbackForm['category'] }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="both" className="ml-3 text-sm text-gray-700">
                      Both
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="other"
                      name="category"
                      value="other"
                      checked={form.category === 'other'}
                      onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value as FeedbackForm['category'] }))}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="other" className="ml-3 text-sm text-gray-700">
                      Something Else
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Applies To
                </label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="marketRents"
                      checked={form.appliesTo.marketRents}
                      onChange={() => handleCheckboxChange('marketRents')}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="marketRents" className="ml-3 text-sm text-gray-700">
                      Market Rents
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="inPlaceRents"
                      checked={form.appliesTo.inPlaceRents}
                      onChange={() => handleCheckboxChange('inPlaceRents')}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="inPlaceRents" className="ml-3 text-sm text-gray-700">
                      In-Place Rents
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="units"
                      checked={form.appliesTo.units}
                      onChange={() => handleCheckboxChange('units')}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="units" className="ml-3 text-sm text-gray-700">
                      Units
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="floorplans"
                      checked={form.appliesTo.floorplans}
                      onChange={() => handleCheckboxChange('floorplans')}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="floorplans" className="ml-3 text-sm text-gray-700">
                      Floorplans
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="sf"
                      checked={form.appliesTo.sf}
                      onChange={() => handleCheckboxChange('sf')}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="sf" className="ml-3 text-sm text-gray-700">
                      SF
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="charges"
                      checked={form.appliesTo.charges}
                      onChange={() => handleCheckboxChange('charges')}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="charges" className="ml-3 text-sm text-gray-700">
                      Charges
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Describe the Issue
              </label>
              <textarea
                id="description"
                required
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="What went wrong with the data extraction?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Source File for Debugging <span className="text-red-600">*</span>
              </label>
              <div 
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${
                  isDragging ? 'border-blue-500 bg-blue-50' : form.file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="space-y-1 text-center">
                  {form.file ? (
                    <>
                      <div className="relative mx-auto w-12 h-12">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="h-10 w-10 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="absolute top-0 right-0 -mr-1 -mt-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-green-600">File attached</p>
                      <p className="text-sm text-gray-800 truncate max-w-xs">
                        {form.file.name}
                      </p>
                      <button 
                        type="button"
                        onClick={() => {
                          setForm(prev => ({ ...prev, file: undefined, reprocessFile: false }));
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove file
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className={`mx-auto h-12 w-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                      <div className="flex text-sm text-gray-600">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                          <span>Upload a file</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            className="sr-only"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        Any file format up to 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Reprocess file toggle - only visible when file is attached */}
            {form.file && (
              <div className="flex items-center bg-blue-50 p-4 rounded-md">
                <div className="flex items-center h-5">
                  <input
                    id="reprocessFile"
                    name="reprocessFile"
                    type="checkbox"
                    checked={form.reprocessFile}
                    onChange={handleToggleReprocess}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="reprocessFile" className="font-medium text-blue-700">
                    Submit file to support for re-processing
                  </label>
                  <p className="text-blue-600">
                    Check this if you would like our support team to try re-processing this file
                  </p>
                </div>
              </div>
            )}

            {/* Manual input fields - shown when URL parameters are missing AND reprocessFile is checked */}
            {(missingVidParams || missingDealParams) && form.reprocessFile && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-yellow-800 mb-4">
                  Additional Information Required
                </h2>
                <p className="text-yellow-700 mb-4">
                  File and/or account details needed for reprocessing are missing. Please provide the following information:
                </p>
                
                {missingVidParams && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="redIQUsername" className="block text-sm font-medium text-gray-700 mb-1">
                        redIQ Username <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        id="redIQUsername"
                        required
                        value={form.redIQUsername}
                        onChange={(e) => setForm(prev => ({ ...prev, redIQUsername: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your redIQ username"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your email address"
                      />
                    </div>
                  </div>
                )}
                
                {missingDealParams && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="dealName" className="block text-sm font-medium text-gray-700 mb-1">
                        Deal Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        id="dealName"
                        required
                        value={form.dealName}
                        onChange={(e) => setForm(prev => ({ ...prev, dealName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter the deal name"
                      />
                    </div>
                    <div>
                      <label htmlFor="dealCounter" className="block text-sm font-medium text-gray-700 mb-1">
                        Deal Counter Number <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        id="dealCounter"
                        required
                        value={form.dealCounter}
                        onChange={(e) => setForm(prev => ({ ...prev, dealCounter: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter the deal counter number"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 text-xs text-gray-500">
              <span className="text-red-600">*</span> Required field
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="-ml-1 mr-2 h-4 w-4" />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default App;