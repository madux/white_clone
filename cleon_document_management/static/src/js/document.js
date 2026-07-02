(function () {
  'use strict';

  var DEFAULT_DATA = {};
  try {
    if (window.__HR_DATA__) DEFAULT_DATA = window.__HR_DATA__;
  } catch(e) {}
  console.log("STARTED FIREEEEE")

  function initializePage(){
    $('#user_name').text(DEFAULT_DATA.user_name);
  }
  /* ─── Colors ──────────────────────────────────────────────── */
  const C = {
    pink:   '#FF2D78',
    blue:   '#4F7FFA',
    green:  '#22C997',
    orange: '#FF8C42',
    yellow: '#FFD166',
    purple: '#9B72CF',
    teal:   '#06D6A0',
    red:    '#FF4757',
    text1:  '#1A1D2E',
    text2:  '#5A6172',
    text3:  '#9AA0B2',
    border: '#EDEEF2',
    bg:     '#F7F8FC',
  };

  const DEPT_COLORS = [C.blue, C.pink, C.orange, C.green, C.purple, C.teal, C.yellow, C.red];

  /* ─── Utility ─────────────────────────────────────────────── */
  function rpc(method, route, params = {}) {
    return fetch(route, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: Date.now(), params }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error.message || 'RPC error');
        return d.result;
      });
  }


  function createDocument() {
    document.addEventListener('click', function (e) {
      if (e.target) {

        rpc('POST', '/api/create-folder', {
          'nameElm': $('#nameElm'), 
          'descriptionElm': $('#descriptionElm'), 
          'id': $('#descriptionElm'), 
        })
          .then(renderHeadcountChart)
          .catch(() => renderHeadcountChart(getDemoHeadcount()));
      }else {
        alert("Element is not found")
      }
    });
  }

  function renderFolders(folders) {
      const $tbody = $("#folderTableBody");
      $tbody.empty();
      if (!folders.length) {
          $tbody.append(`
              <tr>
                  <td colspan="6" class="text-center">
                      No folders found
                  </td>
              </tr>
          `);
          return;
      }

      folders.forEach(folder => {

          const lastModified = folder.last_modified
              ? new Date(folder.last_modified).toLocaleDateString()
              : "N/A";

          const row = `
              <tr class="table-col1" data-id="${folder.id}">

                  <td>
                      <div class="folder">
                          <div class="folder-icon red">
                              <i class="fa-regular fa-file-lines"></i>
                          </div>
                          <span>${folder.folder_name || ''}</span>
                      </div>
                  </td>

                  <td>${folder.description || ''}</td>

                  <td>${folder.document_count || 0}</td>

                  <td>${lastModified}</td>

                  <td>${folder.owner_id || 'N/A'}</td>

                  <td>
                      <div class="dropdown-container">
                          <button class="action folder-action"
                                  data-folder-id="${folder.id}">
                              <i class="fa fa-ellipsis"></i>
                          </button>

                          <div class="folder-dropdown">
                              <button class="dropdown-item view-folder"
                                      data-folder-id="${folder.id}">
                                  <i class="fa fa-eye"></i> View
                              </button>

                              <button class="dropdown-item edit-folder"
                                      data-folder-id="${folder.id}">
                                  <i class="fa fa-pen"></i> Edit
                              </button>

                              <button class="dropdown-item archive-folder"
                                      data-folder-id="${folder.id}">
                                  <i class="fa fa-box-archive"></i> Archive
                              </button>

                              <button class="dropdown-item delete-folder"
                                      data-folder-id="${folder.id}">
                                  <i class="fa fa-trash"></i> Delete
                              </button>
                          </div>
                      </div>
                  </td>
              </tr>
          `;

          $tbody.append(row);
      });
  }

  async function getFolders() {
    try {
        console.log("Fetching contents...");

        const response = await fetch("/api/get-folder", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "call",
                params: {},
                id: Date.now(),
            }),
        });

        console.log("Response:", response);

        if (!response.ok) {
            throw new Error(
                `HTTP Error: ${response.status} ${response.statusText}`
            );
        }

        const result = await response.json();

        console.log("Raw Result:", result);

        // Odoo JSON-RPC error
        if (result.error) {
            throw new Error(
                result.error.data?.message || result.error.message
            );
        }

        // Handle both formats safely
        const payload = result.result || result;

        console.log("Payload:", payload);

        if (!payload.success) {
            throw new Error(payload.message || "Unknown error");
        }

        const folders = payload.data?.data || [];
        const totalCount = payload.data?.total_count || 0;

        console.log("Total Count:", totalCount);

        // folders.forEach(folder => {
        //     console.log(folder.id);
        //     console.log(folder.folder_name);
        //     console.log(folder.description);
        // });

        $("#totalDocument").text(totalCount);
        renderFolders(result.data.data);
        return folders;

    } catch (error) {
        console.error("Error fetching folders:", error);
        return [];
    }
}

  function handleAction(){
      $(document).on('click', '.folder-action', function (e) {
          e.stopPropagation();

          $('.folder-dropdown').removeClass('show');
          $(this).siblings('.folder-dropdown').toggleClass('show');
      });
  }
  $(document).on('click', function () {
      $('.folder-dropdown').removeClass('show');
  });

  $(document).on('click', '.view-folder', function () {
      const folderId = $(this).data('folder-id');

      console.log('View', folderId);

      // window.location.href = `/folders/${folderId}`;
  });
  async function archiveFolder(folderId) {
      return rpc('/api/archive-folder', {
          id: folderId
      });
  }

  async function deleteFolder(folderId) {
      return rpc('/api/delete-folder', {
          id: folderId
      });
  }
  $(document).on('click', '.delete-folder', async function () {
    const folderId = $(this).data('folder-id');

    if (!confirm('Delete this folder?')) {
        return;
    }

    try {
        await deleteFolder(folderId);

        alert('Folder deleted');

        await getFolders();
    } catch (err) {
        console.error(err);
        alert('Failed to delete folder');
    }
});
  $(document).on('click', '.archive-folder', async function () {
    const folderId = $(this).data('folder-id');

    if (!confirm('Archive this folder?')) {
        return;
    }

    try {
        await archiveFolder(folderId);

        alert('Folder archived');

        await getFolders();
    } catch (err) {
        console.error(err);
        alert('Failed to archive folder');
    }
});
  async function init() {
    initializePage();
    await getFolders();
  }
  
  init();
  console.log("FIREEEEE")
})();

