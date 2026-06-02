
window.forms = {
  parseForm(form){
    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach(key => {
      const val = data[key];
      if(val === '') return;
      if(!isNaN(val) && val.trim() !== '') data[key] = Number(val);
    });
    return data;
  },
  bind(){
    const contractorForm = document.getElementById('contractorForm');
    const contractForm = document.getElementById('contractForm');
    const objectForm = document.getElementById('objectForm');

    contractorForm?.addEventListener('submit', e => {
      e.preventDefault();
      window.dashboardState.additions.contractors.push(this.parseForm(contractorForm));
      contractorForm.reset();
      window.app.refresh();
    });

    contractForm?.addEventListener('submit', e => {
      e.preventDefault();
      window.dashboardState.additions.contracts.push(this.parseForm(contractForm));
      contractForm.reset();
      window.app.refresh();
    });

    objectForm?.addEventListener('submit', e => {
      e.preventDefault();
      window.dashboardState.additions.objects.push(this.parseForm(objectForm));
      objectForm.reset();
      window.app.refresh();
    });
  }
};
